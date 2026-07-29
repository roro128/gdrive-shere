export type NavigationLocation = {
  href: string;
  replace: (url: string) => void;
};

export function navigateToGoogle(location: NavigationLocation): void {
  location.href = '/api/auth/google/start';
}

export function redirectToHome(location: NavigationLocation): void {
  location.replace('/');
}
