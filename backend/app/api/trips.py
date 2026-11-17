from fastapi import APIRouter, Header, Request

from app.core.deps import Auth, DbSession
from app.schemas.trips import ParticipantCreate, TripClose, TripCreate, TripExpenseCreate, TripRead
from app.services import trips_service as service
from app.services.audit_service import AuditAction, record

router = APIRouter(prefix="/trips", tags=["trip planner"])


@router.get("", response_model=list[TripRead])
def list_trips(auth: Auth, db: DbSession):
    return [service.trip_read(trip) for trip in service.list_trips(db, auth.id)]


@router.get("/{trip_id}", response_model=TripRead)
def get_trip(trip_id: str, auth: Auth, db: DbSession):
    return service.trip_read(service.get_trip(db, auth.id, trip_id))


@router.post("", response_model=TripRead, status_code=201)
def create_trip(payload: TripCreate, request: Request, auth: Auth, db: DbSession):
    trip = service.create_trip(db, auth.id, payload)
    record(db, request, AuditAction.TRIP_CREATE, user_id=auth.id, target_type="trip", target_id=trip.id)
    db.commit()
    return service.trip_read(service.get_trip(db, auth.id, trip.id))


@router.post("/{trip_id}/participants", response_model=TripRead, status_code=201)
def add_participant(trip_id: str, payload: ParticipantCreate, request: Request, auth: Auth, db: DbSession):
    trip = service.add_participant(db, auth.id, trip_id, payload)
    record(db, request, AuditAction.TRIP_UPDATE, user_id=auth.id, target_type="trip", target_id=trip.id)
    db.commit()
    return service.trip_read(service.get_trip(db, auth.id, trip.id))


@router.post("/{trip_id}/expenses", response_model=TripRead, status_code=201)
def add_expense(trip_id: str, payload: TripExpenseCreate, request: Request, auth: Auth, db: DbSession):
    trip = service.add_expense(db, auth.id, trip_id, payload)
    record(db, request, AuditAction.TRIP_EXPENSE_CREATE, user_id=auth.id, target_type="trip", target_id=trip.id)
    db.commit()
    return service.trip_read(service.get_trip(db, auth.id, trip.id))


@router.delete("/{trip_id}/expenses/{expense_id}", response_model=TripRead)
def delete_expense(trip_id: str, expense_id: str, request: Request, auth: Auth, db: DbSession):
    trip = service.delete_expense(db, auth.id, trip_id, expense_id)
    record(db, request, AuditAction.TRIP_EXPENSE_DELETE, user_id=auth.id, target_type="trip", target_id=trip.id)
    db.commit()
    return service.trip_read(service.get_trip(db, auth.id, trip.id))


@router.post("/{trip_id}/close", response_model=TripRead)
def close_trip(
    trip_id: str,
    payload: TripClose,
    request: Request,
    auth: Auth,
    db: DbSession,
    idempotency_key: str = Header(min_length=8, max_length=100),
):
    # Header validation plus deterministic per-expense keys make retries safe.
    _ = idempotency_key
    trip = service.close_trip(db, auth.id, trip_id)
    record(
        db,
        request,
        AuditAction.TRIP_CLOSE,
        user_id=auth.id,
        target_type="trip",
        target_id=trip.id,
    )
    db.commit()
    return service.trip_read(service.get_trip(db, auth.id, trip.id))
