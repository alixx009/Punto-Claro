import { RouterProvider } from "react-router";
import { appRouter } from "./router/app.router";
import { useAuth } from "./auth/useAuth";
import { LoginScreen } from "./components/auth/LoginScreen";
import { PasswordChangeScreen } from "./components/auth/PasswordChangeScreen";
import { InitialSetupScreen } from "./components/auth/InitialSetupScreen";

function App(): React.JSX.Element {
  const { user, status } = useAuth();
  if (status === "setup-required") return <InitialSetupScreen />;
  if (status !== "authenticated" || !user) return <LoginScreen />;
  if (user.role === "admin" && user.mustChangePassword)
    return <PasswordChangeScreen />;
  const identity = `${user.id}|${user.role}|${[...user.permissions].sort().join(",")}`;
  return <RouterProvider key={identity} router={appRouter} />;
}

export default App;
