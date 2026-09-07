export type FragmentMedia =
  | {
      kind: "image";
      src: string;
      alt: string;
      caption?: string;
    }
  | {
      kind: "audio";
      src: string;
      caption?: string;
    }
  | {
      kind: "video";
      src: string;
      poster?: string;
      caption?: string;
    };

export interface FragmentItem {
  id: string;
  date: string;
  text?: string;
  media?: FragmentMedia;
}

export const fragments: FragmentItem[] = [
  {
    id: "fragments-start",
    date: "2026-09-07",
    text: "有些东西没必要专门写成一篇文章。照片、截图、声音，或者一句话，以后就放在这里。",
  },
];
