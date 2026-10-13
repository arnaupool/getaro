import { updateProfile } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { LanguageSelect } from "@/components/LanguageSelect";
import { ThemeSelect } from "@/components/ThemeToggle";
import { requireProfile } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { ColorPicker } from "./ColorPicker";

export default async function SettingsPage() {
  const me = await requireProfile();
  const { t } = await getI18n();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">{t.settings.title}</h1>

      <ActionForm action={updateProfile} className="card space-y-4">
        <h2 className="font-semibold">{t.settings.profile}</h2>
        <div>
          <label className="label" htmlFor="display_name">
            {t.settings.displayName}
          </label>
          <input
            id="display_name"
            name="display_name"
            required
            maxLength={40}
            defaultValue={me.display_name}
            className="input"
          />
        </div>
        <div>
          <span className="label">{t.settings.color}</span>
          <ColorPicker name="color" defaultValue={me.color} />
        </div>
        <SubmitButton pendingText={t.common.saving}>{t.common.save}</SubmitButton>
      </ActionForm>

      <section className="card space-y-3">
        <h2 className="font-semibold">{t.settings.language}</h2>
        <LanguageSelect />
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">{t.settings.appearance}</h2>
        <ThemeSelect />
      </section>
    </div>
  );
}
