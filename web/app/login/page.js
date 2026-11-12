import { getLocale, getDictionary } from "@/lib/i18n";
import LocaleToggle from "@/components/LocaleToggle";
import LoginForm from "./LoginForm";
import HomeLink from "@/components/HomeLink";

export default async function LoginPage() {
  const locale = await getLocale();
  const { nav, login: t } = getDictionary(locale);

  return (
    <div className="relative flex-1 flex flex-col">
      <HomeLink>{nav.home}</HomeLink>
      <div className="absolute top-4 right-6">
        <LocaleToggle locale={locale} path="/login" dark={false} />
      </div>
      <LoginForm t={t} />
    </div>
  );
}
