import { getLocale, getDictionary } from "@/lib/i18n";
import LocaleToggle from "@/components/LocaleToggle";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const locale = await getLocale();
  const { login: t } = getDictionary(locale);

  return (
    <div className="relative flex-1 flex flex-col">
      <div className="absolute top-4 right-6">
        <LocaleToggle locale={locale} path="/login" dark={false} />
      </div>
      <LoginForm t={t} />
    </div>
  );
}
