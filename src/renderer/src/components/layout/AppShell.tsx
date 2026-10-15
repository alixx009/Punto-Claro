import { Outlet } from "react-router";
import { CustomMenu } from "@/components/custom/CustomMenu";

export const AppShell = () => (
  <div className="flex h-dvh min-w-0 flex-col overflow-hidden [padding-top:env(safe-area-inset-top)] [padding-right:env(safe-area-inset-right)] [padding-bottom:env(safe-area-inset-bottom)] [padding-left:env(safe-area-inset-left)]">
    <CustomMenu />
    <Outlet />
  </div>
);
