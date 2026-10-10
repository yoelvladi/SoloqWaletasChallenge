import { AccountHeader } from "@/components/account-header";
import { ConfirmAccess } from "@/components/confirm-access";

export default function ConfirmPage() {
  return <><AccountHeader/><main className="confirm-page"><section className="access-card"><span className="eyebrow">SOLO POR INVITACIÓN</span><h1>Ya casi estás dentro.</h1><ConfirmAccess/></section></main></>;
}
