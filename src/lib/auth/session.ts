import { getServerSession } from 'next-auth';
import { authOptions } from './options';

export function getServerAuthSession() {
  return getServerSession(authOptions);
}
