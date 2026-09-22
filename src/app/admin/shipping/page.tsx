import { redirect } from 'next/navigation';

// Global (platform-level) shipping zones are not implemented in the API yet; send admins back to the dashboard.
export default function AdminShipping() {
  redirect('/admin');
}
