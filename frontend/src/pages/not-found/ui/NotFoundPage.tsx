import { Link } from 'react-router';
import { PageMessage } from '@/shared/ui/PageMessage';

export function NotFoundPage() {
  return (
    <PageMessage>
      <h1>Страница не найдена</h1>
      <Link to="/">Вернуться на главную</Link>
    </PageMessage>
  );
}
