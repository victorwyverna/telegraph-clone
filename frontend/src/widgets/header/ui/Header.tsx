import { useNavigate } from 'react-router';
import styles from './Header.module.css';

export function Header() {
  const navigate = useNavigate();

  return (
    <header className={styles.siteHeader}>
      <button
        className={styles.logo}
        type="button"
        onClick={() => navigate('/')}
      >
        Telegraph
      </button>
      <button
        className={styles.newArticle}
        type="button"
        onClick={() => navigate('/new')}
      >
        Новая история
      </button>
    </header>
  );
}
