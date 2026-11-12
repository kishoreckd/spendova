import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { SpendovaUser, LoginResponse } from "../src/api/auth/types";
const state = vi.hoisted(() => ({refresh:vi.fn(),me:vi.fn(),login:vi.fn(),logout:vi.fn(),update:vi.fn(),clear:vi.fn()}));
vi.mock("@/lib/query-client", () => ({queryClient:{clear:state.clear}}));
vi.mock("@/api/auth/api", () => ({authApi:{me:state.me,login:state.login,logout:state.logout,updateProfile:state.update}}));
vi.mock("@/api/client", async importOriginal => ({...await importOriginal<typeof import("../src/api/client")>(), refreshAccessToken:state.refresh,waitForRefresh:async () => {}}));
import { AuthProvider, useAuth } from "../src/features/auth/auth-context";
import { clearSession, setAccessToken } from "../src/lib/session";
function Status() {
 const {profile,loading,error,signInWithEmail,signOut,updateProfile}=useAuth();
 return <><span data-testid="status">{profile?.id}:{loading ? "loading" : error ? "error" : "ready"}</span>
 <button onClick={() => void signInWithEmail("a@example.com","Password1").catch(() => {})}>A</button>
 <button onClick={() => void signInWithEmail("b@example.com","Password1").catch(() => {})}>B</button>
 <button onClick={() => void signOut()}>Logout</button>
 <button onClick={() => void updateProfile({display_name:"Changed"})}>Update</button></>;
}
function result(id:string): LoginResponse { return {access_token:`token-${id}`,expires_in_seconds:900,account:{id} as SpendovaUser,development_code:null}; }
afterEach(() => {cleanup();clearSession();vi.clearAllMocks();});
it("ignores a late login response from a superseded account", async () => {
 state.refresh.mockImplementation(async () => {setAccessToken("restored");});state.me.mockResolvedValue({id:"initial"});
 let resolveA!: (result:LoginResponse) => void;
 state.login.mockImplementationOnce(() => new Promise(resolve => {resolveA=resolve;})).mockResolvedValueOnce(result("B"));
 render(<AuthProvider><Status /></AuthProvider>);
 await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("initial:ready"));
 await act(async () => {screen.getByRole("button",{name:"A",exact:true}).click();});
 await act(async () => {screen.getByRole("button",{name:"B",exact:true}).click();});
 await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("B:ready"));
 await act(async () => {resolveA(result("A"));});
 expect(screen.getByTestId("status").textContent).toBe("B:ready");
});
it("does not restore profile data from an update that finishes after logout", async () => {
 state.refresh.mockImplementation(async () => {setAccessToken("restored");});state.me.mockResolvedValue({id:"A"});state.logout.mockResolvedValue(undefined);
 let resolveUpdate!: (user:SpendovaUser) => void;state.update.mockImplementation(() => new Promise(resolve => {resolveUpdate=resolve;}));
 render(<AuthProvider><Status /></AuthProvider>);
 await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("A:ready"));
 await act(async () => {screen.getByRole("button",{name:"Update"}).click();});
 await act(async () => {screen.getByRole("button",{name:"Logout"}).click();});
 await act(async () => {resolveUpdate({id:"A"} as SpendovaUser);});
 expect(screen.getByTestId("status").textContent).toBe(":ready");
});
