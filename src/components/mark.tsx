import Image from "next/image";

export function Mark({
  className = "",
  tone = "violet",
  title = "Imposter",
}: {
  className?: string;
  tone?: "violet" | "rose";
  title?: string;
}) {
  return (
    <Image
      src={`/brand/face-${tone}.webp`}
      width={512}
      height={512}
      sizes="112px"
      alt={title}
      className={`rounded-[24%] ${className}`}
    />
  );
}
