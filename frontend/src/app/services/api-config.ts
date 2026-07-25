import { isDevMode } from '@angular/core';

export const getBaseUrl = (): string => {
  return isDevMode() ? 'http://localhost:3000' : window.location.origin;
};
