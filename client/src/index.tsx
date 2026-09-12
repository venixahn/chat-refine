import { render } from "solid-js/web";
import { Navigate, Route, Router } from "@solidjs/router";
import { App } from "./app.tsx";
import { AppHomePage } from "./pages/app-home.tsx";
import { LandingPage } from "./pages/landing.tsx";
import { LoginPage } from "./pages/login.tsx";
import { SignupPage } from "./pages/signup.tsx";
import "./index.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element missing");
}

render(
  () => (
    <Router root={App}>
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/signup" component={SignupPage} />
      <Route path="/app" component={AppHomePage} />
      <Route path="*404" component={() => <Navigate href="/" />} />
    </Router>
  ),
  root,
);
