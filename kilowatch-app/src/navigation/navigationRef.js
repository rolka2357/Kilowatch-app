import { createNavigationContainerRef } from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef();

export function navigateWhenReady(name, params) {
  const tryNav = (attemptsLeft = 40) => {
    if (navigationRef.isReady()) {
      navigationRef.navigate(name, params);
      return;
    }
    if (attemptsLeft <= 0) return;
    setTimeout(() => tryNav(attemptsLeft - 1), 50);
  };
  tryNav();
}
