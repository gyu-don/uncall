export type SourcePosition = {
  offset: number;
  line: number;
  column: number;
};

export type SourceSpan = {
  start: SourcePosition;
  end: SourcePosition;
};

export const mergeSpans = (start: SourceSpan, end: SourceSpan): SourceSpan => ({
  start: start.start,
  end: end.end,
});
