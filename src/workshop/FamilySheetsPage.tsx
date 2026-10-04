import { useLayoutEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ErrorMessage } from "./App.js";
import { FamilySpriteCanvas, useFamilyImages, useFamilySheets } from "./FamilySheetArt.js";
import { FamilySheetNote } from "./FamilySheetNote.js";
import {
  type FamilyFact,
  type FamilySheetCatalog,
  type FamilySprite,
  familyVariant,
} from "./FamilySheetTypes.js";
import "./family-sheets.css";

export default function FamilySheetsPage() {
  const query = useFamilySheets();
  if (!query.data)
    return (
      <section className="family-page family-loading" aria-live="polite">
        <h1>Family sheets</h1>
        <ErrorMessage error={query.error} />
        {!query.error ? <p>Loading the family sheets…</p> : null}
      </section>
    );
  return <LoadedFamilySheets catalog={query.data} />;
}

function LoadedFamilySheets({ catalog }: { catalog: FamilySheetCatalog }) {
  const images = useFamilyImages(catalog),
    [params, setParams] = useSearchParams(),
    [zoom, setZoom] = useState(3),
    [detailRequest, setDetailRequest] = useState(0),
    detail = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!detailRequest || !detail.current) return;
    const bounds = detail.current.getBoundingClientRect();
    if (bounds.top < 80 || bounds.bottom > window.innerHeight)
      detail.current.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
  }, [detailRequest]);
  const family =
    catalog.families.find((item) => item.id === params.get("family")) ?? catalog.families[0];
  if (!family) return <ErrorMessage error="The family sheets are unavailable." />;
  const variantId =
      family.variants.find((variant) => variant.id === params.get("variant"))?.id ??
      family.variants[0]?.id ??
      "",
    selected = family.groups
      .flatMap((group) => group.members)
      .find((member) => member.id === params.get("member")),
    selectedVariantId =
      selected?.variants.find((variant) => variant.id === params.get("variant"))?.id ?? variantId,
    hasPieceVariants = selected?.variants.some(
      (variant) => !family.variants.some((option) => option.id === variant.id),
    );
  const select = (memberId?: string, nextVariant = variantId) => {
    const next = new URLSearchParams({ family: family.id, variant: nextVariant });
    if (memberId) next.set("member", memberId);
    const revision = params.get("revision");
    if (revision) next.set("revision", revision);
    setParams(next, { preventScrollReset: true });
  };

  return (
    <section className="family-page">
      <nav className="family-tabs" aria-label="Art families">
        {catalog.families.map((item) => (
          <Link
            key={item.id}
            to={`/tool/families?family=${item.id}`}
            aria-current={item.id === family.id ? "page" : undefined}
            preventScrollReset
          >
            {item.name}
          </Link>
        ))}
      </nav>

      <header className="family-heading">
        <div>
          <div className="family-title-line">
            <h1>{family.name}</h1>
            <span className="family-proposed">Proposed</span>
          </div>
          <p>{family.description}</p>
        </div>
        <div className="family-controls">
          {family.variants.length > 1 ? (
            <label className="family-variant">
              {family.variantLabel}
              <select
                aria-label={family.variantLabel}
                value={variantId}
                onChange={(event) => select(selected?.id, event.target.value)}
              >
                {family.variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <fieldset className="family-zoom" aria-label="Artwork zoom">
            {[2, 3, 4].map((value) => (
              <button
                key={value}
                type="button"
                aria-label={`${value}× artwork zoom`}
                aria-pressed={zoom === value}
                onClick={() => setZoom(value)}
              >
                {value}×
              </button>
            ))}
          </fieldset>
        </div>
      </header>

      {params.has("revision") && params.get("revision") !== family.revision ? (
        <p role="status">
          This link refers to an earlier proposal. You are viewing the current sheet.
        </p>
      ) : null}

      <Facts facts={family.facts} className="family-shared-facts" />

      <details className="family-note family-sheet-discussion" key={family.id}>
        <summary>Comment on whole sheet</summary>
        <FamilySheetNote
          catalog={catalog}
          family={family}
          member={null}
          variantId={variantId}
          imagesReady={!!images.data && !images.error}
        />
      </details>

      <div className={`family-detail ${selected ? "has-selection" : ""}`} ref={detail}>
        <div className="family-detail-copy" aria-live="polite">
          {selected ? (
            <>
              <div className="family-detail-title">
                <h2>
                  <span className="family-number">{selected.number}</span> {selected.label}
                </h2>
                <button type="button" onClick={() => select()}>
                  Clear selection
                </button>
              </div>
              {hasPieceVariants ? (
                <label className="family-variant">
                  Piece appearance
                  <select
                    aria-label="Piece appearance"
                    value={selectedVariantId}
                    onChange={(event) => select(selected.id, event.target.value)}
                  >
                    {selected.variants.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {variant.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <Facts facts={selected.facts} />
              {selected.question ? <p className="family-question">{selected.question}</p> : null}
            </>
          ) : (
            <p className="family-selection-hint">
              Choose a piece to see its details or discuss it.
            </p>
          )}
        </div>
        {selected ? (
          <details
            className="family-note family-piece-discussion"
            key={`${family.id}:${selected.id}`}
          >
            <summary>Discuss this piece</summary>
            <FamilySheetNote
              catalog={catalog}
              family={family}
              member={selected}
              variantId={selectedVariantId}
              imagesReady={!!images.data && !images.error}
            />
          </details>
        ) : null}
      </div>

      <ErrorMessage error={images.error} />
      {!images.data || images.error ? (
        <div className="family-art-loading" role="status">
          {images.error
            ? "The artwork could not be verified. Try reloading the sheet."
            : "Checking the artwork…"}
        </div>
      ) : (
        <>
          {family.groups.map((group) => (
            <section className="family-group" key={group.id} aria-labelledby={`family-${group.id}`}>
              <div className="family-group-heading">
                <h2 id={`family-${group.id}`}>{group.title}</h2>
                {group.description ? <p>{group.description}</p> : null}
              </div>
              <div className="family-piece-grid">
                {group.members.map((member) => {
                  const variant = familyVariant(
                    member,
                    selected?.id === member.id ? selectedVariantId : variantId,
                  );
                  return (
                    <button
                      className="family-piece"
                      style={{ width: Math.max(156, variant.sprite.size[0] * zoom + 40) }}
                      type="button"
                      key={member.id}
                      aria-label={`${member.number}. ${member.label}`}
                      aria-pressed={selected?.id === member.id}
                      onClick={() => {
                        select(member.id);
                        setDetailRequest((request) => request + 1);
                      }}
                    >
                      <SpriteStage
                        sprite={variant.sprite}
                        images={images.data}
                        zoom={zoom}
                        label={member.label}
                      />
                      <span className="family-piece-caption">
                        <span className="family-number">{member.number}</span>
                        <span>{member.label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          {family.examples.length ? (
            <section className="family-examples" aria-labelledby="family-examples-heading">
              <h2 id="family-examples-heading">Together</h2>
              <div className="family-example-grid">
                {family.examples.map((example) => (
                  <figure
                    key={example.id}
                    className={example.variants[0]?.sprite.background ? "is-large" : undefined}
                  >
                    <SpriteStage
                      sprite={familyVariant(example, variantId).sprite}
                      images={images.data}
                      zoom={2}
                      label={example.label}
                    />
                    <figcaption>
                      <strong>{example.label}</strong>
                      <p>{example.description}</p>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </section>
  );
}

function Facts({ facts, className = "" }: { facts: FamilyFact[]; className?: string }) {
  if (!facts.length) return null;
  return (
    <dl className={`family-facts ${className}`}>
      {facts.map((fact) => (
        <div key={fact.label}>
          <dt>{fact.label}</dt>
          <dd>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Keep exact pixel steps, shrinking large assemblies only to another integer zoom. */
function SpriteStage({
  sprite,
  images,
  zoom,
  label,
}: {
  sprite: FamilySprite;
  images: Map<string, HTMLImageElement>;
  zoom: number;
  label: string;
}) {
  const stage = useRef<HTMLSpanElement>(null),
    [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = stage.current;
    if (!element) return;
    const measure = () => {
      const style = getComputedStyle(element);
      setWidth(
        element.clientWidth -
          Number.parseFloat(style.paddingLeft) -
          Number.parseFloat(style.paddingRight),
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const fittedZoom = Math.min(zoom, Math.max(1, Math.floor(width / sprite.size[0])));
  return (
    <span className="family-sprite-stage" ref={stage}>
      <span className="family-sprite-inner">
        <FamilySpriteCanvas sprite={sprite} images={images} zoom={fittedZoom} label={label} />
      </span>
    </span>
  );
}
