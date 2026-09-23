export default function LoginArtwork({ side }: { side: 'left' | 'right' }) {
  return (
    <picture className="pointer-events-none hidden min-w-0 max-w-sm flex-1 select-none lg:block">
      <source media="(min-width: 1024px)" srcSet={`assets/login/director-${side}-fullbody.png`} />
      <img
        src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
        alt=""
        width={1024}
        height={1536}
        decoding="async"
        draggable={false}
        className="max-h-[76svh] w-full object-contain"
      />
    </picture>
  );
}
