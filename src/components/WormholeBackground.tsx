const RINGS = Array.from({ length: 8 }, (_, index) => index);

export function WormholeBackground() {
  return (
    <div className="umbra-wormhole" aria-hidden="true">
      <div className="umbra-wormhole__tunnel">
        {RINGS.map((index) => (
          <span
            key={index}
            className="umbra-wormhole__ring"
            style={{ animationDelay: `${index * -1.15}s` }}
          />
        ))}
        <div className="umbra-wormhole__core" />
      </div>
    </div>
  );
}
