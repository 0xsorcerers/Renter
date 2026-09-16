import asyncio
import base64
import os
from pathlib import Path

from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

load_dotenv(Path(__file__).parent / ".env")
OUT = Path("/app/frontend/assets/images/art")
OUT.mkdir(parents=True, exist_ok=True)
LOGO = Path("/app/frontend/assets/images/logo.png")

STYLE = (
    "Minimal continuous single-line art illustration, clean navy blue ink lines (#1F3A5F) on an off-white paper background (#FCFCF9), "
    "with small flat sunny-yellow (#F4D03F) accent fills only on windows. No text, no people, no shading, no gradients, lots of empty negative space, "
    "square composition, subject anchored to the bottom half so the top half stays mostly empty. Match the style of the reference logo exactly."
)

SCENES = {
    "welcome": "a cosy cottage with a satellite dish on the roof and a winding path leading to the front door",
    "explore": "a small skyline of varied houses and apartment blocks on a gentle hill with a location pin floating above them",
    "saved": "a house shaped like a heart-topped mailbox with a tiny key on a ribbon hanging from it",
    "activity": "a house with an open door and a speech bubble containing a small key, papers flying like offers",
    "profile": "a front porch with a rocking chair, a potted plant and a hanging lantern",
    "chat": "two little houses facing each other connected by a string-and-cups telephone line",
    "create": "a house under construction with a crane lifting a rooftop, blueprint lines on the ground",
    "rented": "a house with a 'sold' style ribbon bow on the roof and a small welcome mat at the door",
}


async def gen(name: str, scene: str, ref_b64: str):
    chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"art-{name}", system_message="You are an illustrator.")
    chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
    msg = UserMessage(text=f"{STYLE} Scene: {scene}.", file_contents=[ImageContent(ref_b64)])
    for attempt in range(2):
        try:
            _text, images = await chat.send_message_multimodal_response(msg)
            if images:
                (OUT / f"{name}.png").write_bytes(base64.b64decode(images[0]["data"]))
                print("saved", name)
                return
        except Exception as e:
            print("retry", name, str(e)[:120])
    print("FAILED", name)


async def main():
    ref_b64 = base64.b64encode(LOGO.read_bytes()).decode()
    await asyncio.gather(*(gen(n, s, ref_b64) for n, s in SCENES.items()))


asyncio.run(main())
