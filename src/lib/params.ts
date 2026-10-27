// 쿼리 파라미터의 숫자 코드 파싱. 숫자가 아니면 undefined.
export const parseCode = (value: string | null) => {
  if ( value === null || !/^\d+$/.test(value) ) return undefined;
  return Number(value);
};
