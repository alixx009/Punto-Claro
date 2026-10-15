import { RouterProvider } from "react-router";
import { appRouter } from "./router/app.router";
import { useAuth } from "./auth/useAuth";
import { LoginScreen } from "./components/auth/LoginScreen";
import { PasswordChangeScreen } from "./components/auth/PasswordChangeScreen";
import { InitialSetupScreen } from "./components/auth/InitialSetupScreen";
import { UpdateNotice } from "./components/updates/UpdateNotice";

function App(): React.JSX.Element {
  const { user, status } = useAuth();
  const identity = user
    ? `${user.id}|${user.role}|${[...user.permissions].sort().join(",")}`
    : "unauthenticated";
  const screen =
    status === "setup-required" ? (
      <InitialSetupScreen />
    ) : status !== "authenticated" || !user ? (
      <LoginScreen />
    ) : user.role === "admin" && user.mustChangePassword ? (
      <PasswordChangeScreen />
    ) : (
      <RouterProvider key={identity} router={appRouter} />
    );
  return (
    <>
      <UpdateNotice />
      {screen}
    </>
  );
}

export default App;
