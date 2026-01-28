import { createBrowserRouter } from "react-router";
import { WelcomeScreen } from "@/app/components/welcome-screen";
import { MenuScreen } from "@/app/components/menu-screen";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: WelcomeScreen,
  },
  {
    path: "/menu",
    Component: MenuScreen,
  },
]);
