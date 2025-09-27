'use client';

import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { HEADER_PORTAL_ID } from './header-portal-id';

type HeaderPortalProps = {
  children: ReactNode;
};

export function HeaderPortal({ children }: HeaderPortalProps) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const element = document.getElementById(HEADER_PORTAL_ID);
    if (element instanceof HTMLElement) {
      setTarget(element);
    }
  }, []);

  if (!target) return null;

  return createPortal(children, target);
}
