import { Mark } from "@/components/mark";
import { Screen } from "@/components/shell";
import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <Screen className="items-center justify-center text-center">
      <Mark className="h-20 w-20 opacity-80" />
      <h1 className="mt-6 text-3xl font-extrabold text-white">Nothing to see here</h1>
      <p className="mt-2 text-mist-400">That page doesn&apos;t exist. Suspicious.</p>
      <div className="mt-8 w-full">
        <ButtonLink href="/">Back to home</ButtonLink>
      </div>
    </Screen>
  );
}
