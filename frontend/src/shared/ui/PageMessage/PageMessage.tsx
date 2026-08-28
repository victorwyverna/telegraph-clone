import type { PropsWithChildren } from 'react';

import styles from './PageMessage.module.css';

export function PageMessage({ children }: PropsWithChildren) {
  return <main className={styles.pageMessage}>{children}</main>;
}
