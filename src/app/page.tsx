import Link from "next/link";
import { Mark } from "@/components/mark";
import { ResumeRound } from "@/components/resume-round";
import { Screen, Spotlight } from "@/components/shell";
import { ButtonLink } from "@/components/ui";

export default function Home() {
  return (
    <Screen className="justify-center overflow-hidden text-center">
      <Spotlight />
      <div className="animate-rise">
        <Mark className="mx-auto h-28 w-28 drop-shadow-[0_24px_50px_rgba(139,92,246,0.45)]" />
      </div>
      <h1 className="mt-7 text-6xl font-extrabold tracking-tight text-white animate-rise [animation-delay:80ms]">Imposter</h1>
      <p lang="ml" className="mt-1 text-2xl font-semibold text-violet-400 animate-rise [animation-delay:140ms]">
        മലയാളം
      </p>
      <p className="mx-auto mt-5 max-w-xs text-lg leading-relaxed text-mist-400 animate-rise [animation-delay:200ms]">
        Everyone gets the same secret word. One of you doesn&apos;t. Find the Imposter before they fool you.
      </p>
      <div className="mt-10 flex flex-col gap-3 animate-rise [animation-delay:280ms]">
        <ButtonLink href="/new">Start a game</ButtonLink>
        <ButtonLink href="/join" variant="secondary">
          Join with a code
        </ButtonLink>
        <ResumeRound />
      </div>
      <div className="mt-8 flex flex-col items-center gap-2 text-sm text-mist-500 animate-rise [animation-delay:360ms]">
        <p>Everyone plays on their own phone · 3 to 20 players</p>
        <p>
          <Link href="/setup" className="font-semibold text-mist-400 underline-offset-4 hover:text-mist-200 hover:underline">
            Only one phone? Pass &amp; play
          </Link>
          <span className="mx-2">·</span>
          <Link href="/how-to-play" className="font-semibold text-mist-400 underline-offset-4 hover:text-mist-200 hover:underline">
            How to play
          </Link>
        </p>
      </div>
    </Screen>
  );
}
