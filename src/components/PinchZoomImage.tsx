import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

export function PinchZoomImage({ src, alt }: { src: string; alt?: string }) {
  return (
    <TransformWrapper minScale={1} maxScale={5} doubleClick={{ mode: "toggle" }}>
      <TransformComponent
        wrapperClass="!w-full !h-full"
        contentClass="!w-full !h-full flex items-center justify-center"
      >
        <img
          src={src}
          alt={alt ?? ""}
          className="max-w-full max-h-[80vh] object-contain select-none"
          draggable={false}
        />
      </TransformComponent>
    </TransformWrapper>
  );
}
