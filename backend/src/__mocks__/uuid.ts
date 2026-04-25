let counter = 0;

export const v4 = (): string => {
  counter++;
  return `00000000-0000-4000-a000-${counter.toString().padStart(12, '0')}`;
};

export const v7 = (): string => {
  counter++;
  return `00000000-0000-7000-a000-${counter.toString().padStart(12, '0')}`;
};

export default { v4, v7 };
