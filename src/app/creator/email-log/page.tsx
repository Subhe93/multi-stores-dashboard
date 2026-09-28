import { redirect } from 'next/navigation';

// Merged into the Email page; kept so old links keep working.
export default function CreatorEmailLogRedirect() {
  redirect('/creator/email');
}
