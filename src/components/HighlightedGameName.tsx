"use client";

import React from "react";

type HighlightedGameNameProps = {
  name: string;
  query: string;
};

export function HighlightedGameName({ name, query }: HighlightedGameNameProps) {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return <>{name}</>;
  }

  const index = name.toLocaleLowerCase("es-ES").indexOf(trimmedQuery.toLocaleLowerCase("es-ES"));

  if (index < 0) {
    return <>{name}</>;
  }

  return (
    <>
      {name.slice(0, index)}
      <mark>{name.slice(index, index + trimmedQuery.length)}</mark>
      {name.slice(index + trimmedQuery.length)}
    </>
  );
}
