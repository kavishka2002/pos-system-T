import { redirect } from "next/navigation";

export default function RootPage() {
  // Server-side redirect from "/" to "/login"
  redirect("/login");
}
