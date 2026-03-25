import { redirect } from "next/navigation";

export default function LegacyAuthPage() {
  redirect("/login");
}
