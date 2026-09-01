import type { JSX } from "react";
import { Navigate, useParams } from "react-router-dom";

export default function LegacyEnglishEpisodeRedirect(): JSX.Element {
  const { itemId = "" } = useParams();
  return <Navigate replace to={`/resources/6minuteenglish/${itemId}`} />;
}
