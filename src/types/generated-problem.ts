import type { Problem } from '@prisma/client';

export type GeneratedProblem = Omit<
  Problem,
  | 'id'
  | 'audioEnUrl'
  | 'audioJaUrl'
  | 'audioEnReplyUrl'
  | 'imageUrl'
  | 'createdAt'
  | 'updatedAt'
  | 'incorrectOptions'
  | 'audioReady'
> & {
  incorrectOptions: string[];
};
