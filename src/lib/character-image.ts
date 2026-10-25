// 실험체 이미지 매핑은 이 파일 한 곳에서만 한다.
// 팬킷 이미지(public/characters/{code}.webp, 55×55)는 사용 허가 확인 전이라 git에서 제외되어 있다.
// 허가 상황이 바뀌면 이 플래그나 경로만 바꾼다.
export const CHARACTER_IMAGES_ENABLED = true;

export const characterImageSrc = (code: number) => `/characters/${ code }.webp`;
