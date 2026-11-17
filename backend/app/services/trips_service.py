from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.finance import MONEY, TransactionType, allocate_equal
from app.db.models.trip_model import Trip, TripExpense, TripExpenseShare, TripParticipant, TripSettlement
from app.db.models.user_model import User
from app.schemas.transactions import TransactionCreate
from app.schemas.trips import ParticipantCreate, SettlementCreate, TripCreate, TripExpenseCreate
from app.services import categories_service, transactions_service


def get_trip(db: Session, user_id: str, trip_id: str) -> Trip:
    trip = db.scalar(select(Trip).where(Trip.id == trip_id, Trip.user_id == user_id))
    if not trip:
        raise AppError.not_found("Trip not found")
    return trip


def list_trips(db: Session, user_id: str) -> list[Trip]:
    return list(db.scalars(select(Trip).where(Trip.user_id == user_id).order_by(Trip.created_at.desc())).all())


def create_trip(db: Session, user_id: str, payload: TripCreate) -> Trip:
    user = db.get(User, user_id)
    trip = Trip(user_id=user_id, **payload.model_dump(exclude={"participants"}))
    trip.participants.append(TripParticipant(name=(user.display_name if user else None) or "You", is_user=True))
    if payload.mode == "split":
        names = {name.casefold() for name in payload.participants}
        if len(names) != len(payload.participants):
            raise AppError.bad_request("Participant names must be unique")
        if trip.participants[0].name.casefold() in names:
            raise AppError.bad_request("Participant names must be unique")
        for name in payload.participants:
            trip.participants.append(TripParticipant(name=name))
    db.add(trip)
    db.flush()
    return trip


def _assert_open(trip: Trip) -> None:
    if trip.status == "closed":
        raise AppError.bad_request("Closed trips cannot be changed")


def _participants(trip: Trip) -> dict[str, TripParticipant]:
    return {participant.id: participant for participant in trip.participants}


def _replace_equal_shares(expense: TripExpense, participant_ids: list[str]) -> None:
    amounts = allocate_equal(expense.amount, len(participant_ids))
    expense.shares = [
        TripExpenseShare(participant_id=participant_id, amount=value)
        for participant_id, value in zip(participant_ids, amounts, strict=True)
    ]


def add_participant(db: Session, user_id: str, trip_id: str, payload: ParticipantCreate) -> Trip:
    trip = get_trip(db, user_id, trip_id)
    _assert_open(trip)
    if len(trip.participants) >= 20:
        raise AppError.bad_request("A trip can have up to 20 participants")
    if any(item.name.casefold() == payload.name.casefold() for item in trip.participants):
        raise AppError.bad_request("Participant name already exists")
    trip.mode = "split"
    trip.participants.append(TripParticipant(name=payload.name))
    db.flush()
    all_ids = [participant.id for participant in trip.participants]
    for expense in trip.expenses:
        if expense.split_mode == "equal":
            _replace_equal_shares(expense, all_ids)
    return trip


def add_expense(db: Session, user_id: str, trip_id: str, payload: TripExpenseCreate) -> Trip:
    trip = get_trip(db, user_id, trip_id)
    _assert_open(trip)
    expense = TripExpense(trip_id=trip.id)
    _apply_expense(db, user_id, trip, expense, payload)
    trip.expenses.append(expense)
    db.flush()
    return trip


def update_expense(db: Session, user_id: str, trip_id: str, expense_id: str, payload: TripExpenseCreate) -> Trip:
    """Replaces an expense's details, payer and split (open trips only)."""
    trip = get_trip(db, user_id, trip_id)
    _assert_open(trip)
    expense = next((item for item in trip.expenses if item.id == expense_id), None)
    if not expense:
        raise AppError.not_found("Trip expense not found")
    _apply_expense(db, user_id, trip, expense, payload)
    db.flush()
    return trip


def _apply_expense(db: Session, user_id: str, trip: Trip, expense: TripExpense, payload: TripExpenseCreate) -> None:
    participants = _participants(trip)
    if payload.payer_participant_id not in participants:
        raise AppError.bad_request("Payer is not part of this trip")
    if trip.mode == "personal" and payload.split_mode != "personal":
        raise AppError.bad_request("Personal trips use a personal split")
    category = categories_service.require_category(
        db, user_id, payload.category_id, "expense", "Trip expenses require an expense category"
    )
    expense.description = payload.description
    expense.category = category.name
    expense.amount = payload.amount
    expense.occurred_on = payload.occurred_on
    expense.payer_participant_id = payload.payer_participant_id
    expense.category_id = category.id
    expense.split_mode = payload.split_mode
    expense.notes = payload.notes
    if payload.split_mode == "custom":
        if not payload.shares or payload.participant_ids:
            raise AppError.bad_request("Custom split requires participant amounts")
        ids = [share.participant_id for share in payload.shares]
        if len(ids) != len(set(ids)) or any(item not in participants for item in ids):
            raise AppError.bad_request("Custom split contains an invalid participant")
        total = sum((share.amount for share in payload.shares), Decimal(0)).quantize(MONEY)
        if total != payload.amount.quantize(MONEY):
            raise AppError.bad_request("Custom shares must equal the expense amount")
        expense.shares = [
            TripExpenseShare(participant_id=item.participant_id, amount=item.amount) for item in payload.shares
        ]
    elif payload.split_mode == "personal":
        owner = next((item for item in trip.participants if item.is_user), None)
        if not owner:
            raise AppError.bad_request("Trip owner is missing")
        expense.shares = [TripExpenseShare(participant_id=owner.id, amount=payload.amount)]
    else:
        if payload.participant_ids:
            raise AppError.bad_request("Equal split includes every traveller; use custom amounts for a subset")
        ids = list(participants)
        _replace_equal_shares(expense, ids)


def delete_expense(db: Session, user_id: str, trip_id: str, expense_id: str) -> Trip:
    trip = get_trip(db, user_id, trip_id)
    _assert_open(trip)
    expense = next((item for item in trip.expenses if item.id == expense_id), None)
    if not expense:
        raise AppError.not_found("Trip expense not found")
    db.delete(expense)
    db.flush()
    return trip


def add_settlement(db: Session, user_id: str, trip_id: str, payload: SettlementCreate) -> Trip:
    """Records a payment between travellers. Allowed after the trip is finished; never posts to the ledger."""
    trip = get_trip(db, user_id, trip_id)
    participants = _participants(trip)
    if payload.from_participant_id not in participants or payload.to_participant_id not in participants:
        raise AppError.bad_request("Both travellers must be part of this trip")
    trip.settlements.append(
        TripSettlement(
            from_participant_id=payload.from_participant_id,
            to_participant_id=payload.to_participant_id,
            amount=payload.amount,
            occurred_on=payload.occurred_on,
        )
    )
    db.flush()
    return trip


def delete_settlement(db: Session, user_id: str, trip_id: str, settlement_id: str) -> Trip:
    trip = get_trip(db, user_id, trip_id)
    settlement = next((item for item in trip.settlements if item.id == settlement_id), None)
    if not settlement:
        raise AppError.not_found("Payment not found")
    trip.settlements.remove(settlement)
    db.flush()
    return trip


def close_trip(db: Session, user_id: str, trip_id: str) -> Trip:
    trip = get_trip(db, user_id, trip_id)
    if trip.status != "closed":
        if not trip.expenses:
            raise AppError.bad_request("Add at least one expense before closing the trip")
        owner = next(item for item in trip.participants if item.is_user)
        for expense in trip.expenses:
            if expense.posted_transaction_id:
                continue
            owner_share = next((item.amount for item in expense.shares if item.participant_id == owner.id), None)
            if not owner_share:
                continue
            category = categories_service.require_category(
                db, user_id, expense.category_id, "expense", "A trip expense category is unavailable"
            )
            transaction, _ = transactions_service.create_transaction(
                db,
                user_id,
                TransactionCreate(
                    kind=TransactionType.EXPENSE,
                    amount=owner_share,
                    source="Trip allocation",
                    destination=category.name,
                    merchant=trip.name,
                    occurred_on=expense.occurred_on,
                    currency=trip.currency,
                    category_id=category.id,
                    notes=f"{expense.description} · Your share of {trip.name}"[:500],
                ),
                _posting_key(trip, expense),
            )
            expense.posted_transaction_id = transaction.id
        trip.status = "closed"
    return trip


def _posting_key(trip: Trip, expense: TripExpense) -> str:
    # Revision 0 keeps the original key so trips closed before reopening existed stay idempotent.
    base = f"trip:{trip.id}:expense:{expense.id}"
    return base if not trip.revision else f"{base}:r{trip.revision}"


def reopen_trip(db: Session, user_id: str, trip_id: str) -> Trip:
    """Voids the ledger postings made at close so the trip can be corrected and closed again."""
    trip = get_trip(db, user_id, trip_id)
    if trip.status != "closed":
        return trip
    for expense in trip.expenses:
        if expense.posted_transaction_id:
            transactions_service.void_transaction(db, user_id, expense.posted_transaction_id)
            expense.posted_transaction_id = None
    trip.status = "planning"
    trip.revision = (trip.revision or 0) + 1
    db.flush()
    return trip


def delete_trip(db: Session, user_id: str, trip_id: str) -> None:
    """Removes the trip. Ledger transactions already posted by a close are kept."""
    trip = get_trip(db, user_id, trip_id)
    for expense in list(trip.expenses):
        db.delete(expense)  # before participants: an expense's payer is RESTRICT
    db.flush()
    db.delete(trip)
    db.flush()


def trip_read(trip: Trip) -> dict:
    paid = {item.id: Decimal(0) for item in trip.participants}
    shares = {item.id: Decimal(0) for item in trip.participants}
    settled = {item.id: Decimal(0) for item in trip.participants}
    for expense in trip.expenses:
        paid[expense.payer_participant_id] += expense.amount
        for share in expense.shares:
            shares[share.participant_id] += share.amount
    for settlement in trip.settlements:
        settled[settlement.from_participant_id] += settlement.amount
        settled[settlement.to_participant_id] -= settlement.amount
    balances = []
    for participant in trip.participants:
        balance = (paid[participant.id] - shares[participant.id] + settled[participant.id]).quantize(MONEY)
        balances.append(
            {
                "participant_id": participant.id,
                "name": participant.name,
                "paid": paid[participant.id],
                "share": shares[participant.id],
                "balance": balance,
            }
        )
    owner = next(item for item in trip.participants if item.is_user)
    owner_balance = (paid[owner.id] - shares[owner.id] + settled[owner.id]).quantize(MONEY)
    return {
        "id": trip.id,
        "name": trip.name,
        "destination": trip.destination,
        "start_on": trip.start_on,
        "end_on": trip.end_on,
        "mode": trip.mode,
        "status": trip.status,
        "currency": trip.currency,
        "budget": trip.budget,
        "notes": trip.notes,
        "created_at": trip.created_at,
        "updated_at": trip.updated_at,
        "participants": trip.participants,
        "expenses": trip.expenses,
        "settlements": trip.settlements,
        "balances": balances,
        "total_spent": sum((item.amount for item in trip.expenses), Decimal(0)),
        "user_share": shares[owner.id],
        "user_paid": paid[owner.id],
        "others_owe_user": max(Decimal(0), owner_balance),
        "user_owes_others": max(Decimal(0), -owner_balance),
    }
