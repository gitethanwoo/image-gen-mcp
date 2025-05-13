Perfect. I’ll gather the precise input schemas, parameter formats, and example payloads for the Recraft SVG, Flux Dev, Flux 1.1 Pro models from Replicate, and OpenAI’s `gpt-image-1` image generation model. I’ll also ensure the final TypeScript-based MCP server design supports structured logging and propagates errors clearly to the client, so LLM-based clients can reason over failures effectively.

I’ll get back to you with full parameter definitions, expected tool endpoints (`generate-openai`, `generate-fluxdev`, `generate-fluxpro`, `generate-svg`), and usage patterns tailored to Cloudflare Workers in TypeScript.


# Recraft V3 SVG (Replicate)

**Model:** Recraft V3 SVG (code-named “red\_panda”) on Replicate is a text-to-image model specialized for generating high-quality **SVG vector graphics**, including logos and icons.

**Input Parameters:**

* **`prompt`** (string, **required**): The text description of the image you want to generate. This is the only required field.
* **`size`** (string, optional): The output SVG image dimensions, in `"{width}x{height}"` format (pixels). Default is `"1024x1024"`. For example, `"512x512"` or `"1024x1024"`. The model will scale the output to these dimensions.
* **`style`** (string, optional): The visual style of the generated SVG. Default is `"any"` (no specific style). Supported style options include:

  * `"any"` – no enforced style (let the model decide)
  * `"engraving"` – engraving/etching style line art
  * `"line_art"` – simple line art drawings
  * `"line_circuit"` – circuit-like line style (technical diagrams)
  * `"linocut"` – bold linocut/woodcut style art
    *(These are enumerated style keywords the model recognizes.)*

**Default Behavior:** If no `size` is given, the model generates a 1024×1024 SVG by default. If no `style` is specified, it assumes a general style (“any”) which means the output style may vary. The model produces **one SVG image per request** by default (there is no built-in `num_outputs` parameter for multiple SVGs in one call).

**Output Format:** The model returns an **SVG image** as its output. In the Replicate API, the prediction result will include a URL to the generated `.svg` file (or the SVG content itself) rather than a raster image. The output is vector graphics, so it can be scaled to any resolution without loss of quality. (Keep in mind that if your application expects a raster image, you may need to rasterize the SVG or handle it accordingly.)

**Example API Payload:** To call this model via the Replicate API, you would create a prediction with the model `recraft-ai/recraft-v3-svg` and provide the input parameters. For example, a JSON payload might look like:

```json
{
  "version": "<recraft-v3-svg-model-version-id>",
  "input": {
    "prompt": "A flat design icon of a rocket ship",
    "size": "512x512",
    "style": "line_art"
  }
}
```

This would request an SVG of a rocket ship icon in 512×512 size with a line art style. In this case, the model would return an SVG image matching the prompt in the specified style.

**Quirks and Notes:** The Recraft SVG model is geared toward **vector styles**. It may not produce photorealistic images – instead, it excels at stylized graphics, logos, and icons. The `style` parameter must be one of the supported enums; if an unsupported style is given, the model might ignore it or default to “any.” Also note that the output being SVG means it’s composed of XML vector instructions; the complexity of the SVG (number of nodes/paths) will depend on the prompt and chosen style. For instance, `"line_circuit"` might produce an intricate SVG with many small line segments. Ensure your client can handle the SVG output appropriately (e.g., rendering in a browser or editing in a vector graphics tool).

# Flux 1 \[dev] (Replicate)

**Model:** FLUX 1.0 \[dev] (12B parameters) by Black Forest Labs on Replicate. This is the “developer” version of the FLUX text-to-image model. It can generate high-quality raster images from text and is an open-weight model intended for experimentation and fine-tuning.

**Input Parameters:**

* **`prompt`** (string, **required**): The text description of the image to generate. This model supports detailed prompts describing the scene, subject, style, etc.
* **`seed`** (integer, optional): Random seed for deterministic output. If provided, the model will produce the same image for the same prompt+seed combination (useful for reproducibility). If omitted, a random seed is used, yielding a new random image each run.
* **`go_fast`** (boolean, optional): Enables an accelerated generation mode using the “Flux Schnell” inference optimizations. Default is `true` (fast mode on). In fast mode, the model uses a compiled FP8 quantized version and can generate images in as few as **1–4 diffusion steps**. Disabling `go_fast` (`false`) will run the model in its original mode (BF16 precision), which allows more iterative refinement but is slower. You might disable `go_fast` if you need maximum quality and are willing to trade off speed.
* **`num_inference_steps`** (integer, optional): The number of diffusion steps to run **if** not in fast mode. When `go_fast=true`, the model inherently only needs \~4 steps, so this parameter is effectively capped (and defaults to 4 in that case). If `go_fast=false`, you can specify a higher number of denoising steps to potentially improve quality. Typical values range from 25 to 50 steps for flux-dev in full precision mode. (If not provided, a default is used – in fast mode the default is 4, in slow mode a higher default like 50 may apply.)
* **`aspect_ratio`** (string, optional): The aspect ratio of the output image. Default is `"1:1"` (square). Supported aspect ratios include common formats such as `"16:9"`, `"9:16"`, `"3:2"`, `"2:3"`, `"4:3"`, `"3:4"`, `"21:9"`, `"9:21"`, `"4:5"`, `"5:4"`, etc.. You must use one of the predefined ratio strings (the model will internally set the appropriate width and height for the chosen ratio). If an invalid ratio is given, the API will likely error or default to 1:1.
* **`megapixels`** (string or enum, optional): The resolution scale of the output. Default is `"1"` which corresponds to the model’s standard resolution (around 1 megapixel, e.g. 1024×1024 for 1:1). You can set `"0.25"` to generate a lower resolution image \~0.25 MP (for example, \~512×512 square) for faster results. This parameter lets you trade off resolution vs. speed/cost. (Only the values `"1"` and `"0.25"` are supported in this model’s API.)
* **`num_outputs`** (integer, optional): How many images to generate per request. Range 1–4, default is 1. If you request multiple outputs, the model will produce an array of images for the same prompt. Bear in mind each image counts separately toward usage.
* **`output_format`** (string, optional): Format of the generated image file. Options include `"webp"`, `"jpg"`, or `"png"`. Default is `"webp"` because WebP offers a good balance of quality and size. You can choose PNG for lossless output (or if you need transparency in edited images) or JPG for wide compatibility.
* **`output_quality`** (integer, optional): Quality setting for lossy output formats (relevant for `jpg` or `webp`). Range is 0–100, where higher means less compression (better quality, larger file). Default is 80, which is a reasonable default for high-quality web images. This is ignored if `output_format` is PNG (which is lossless).
* **`disable_safety_checker`** (boolean, optional): By default, FLUX dev on Replicate uses a safety filter to detect and block disallowed or unsafe content in the generated image. Setting this to `true` will **disable** the safety checker (use with caution). Default is `false` (safety checker on). If disabled, the model may produce content outside of Replicate’s content guidelines, so only do this if you have a good reason and handle the output appropriately.

**Default Behavior:** With `go_fast=true` (the default), the flux-dev model generates one image quickly using \~4 inference steps and the FP8-optimized pipeline. It defaults to a square 1024×1024 output (1 MP) unless you specify a different aspect ratio or resolution. The default classifier-free guidance scale for this model is around **3.5**, which is tuned for prompt adherence – this value isn’t directly exposed as a parameter in the Replicate API (there is no separate `guidance_scale` field in the public schema), meaning the model internally uses a fixed guidance setting that balances prompt fidelity and creativity. *(In practice, the flux models were trained with a guidance distillation technique such that **CFG=1.0 corresponds to no negative prompt**; the developers recommend a guidance of \~3.5 for good results. Since negative prompts are not supported by flux-dev, the guidance acts a bit differently than Stable Diffusion – this detail is handled under the hood.)* If the prompt or output triggers the safety filter, you will get an error and no image (unless you disabled the safety checker).

**Output Format:** The result will be a **Raster image** in the format you requested (WebP by default). The Replicate API will typically return a URL to the generated image file. For example, you’ll get a JSON response containing something like:

```json
{
  "status": "succeeded",
  "output": [
    "https://replicate.delivery/pbxt/YourImageFile...webp"
  ]
}
```

If `num_outputs > 1`, there will be multiple URLs in the `output` array, one for each image.

**Example API Payload:** Below is an example of a JSON payload to invoke this model via the Replicate REST API (assuming you have the latest model version ID for `black-forest-labs/flux-dev`):

```json
{
  "version": "<flux-dev-model-version-id>",
  "input": {
    "prompt": "A serene mountain landscape at sunset, digital painting",
    "aspect_ratio": "16:9",
    "num_outputs": 2,
    "output_format": "png"
  }
}
```

This will request two images (`num_outputs: 2`) of a mountain landscape in 16:9 widescreen aspect, returned as PNG files. We did not set `seed`, so each image will be a different random variation. We also did not specify `go_fast`, so it defaults to `true` (fast mode). In the response, you would receive two image URLs (since `num_outputs=2`), along with metadata about the prediction.

**Quirks and Notes:** The Flux dev model **does not support negative prompts** in the way Stable Diffusion does – there is no `negative_prompt` field. All prompt guidance is positive (however, there are community “hacks” to approximate negative prompts via dynamic thresholding, but that’s not natively in the API). The effective strength of the prompt is governed by the model’s internal guidance scale (around 3.5), so if you find the model isn’t following the prompt closely, it could be due to that fixed setting. Also, because of the fast-generation design, **using too few steps (e.g., 1 step)** can lead to very crude outputs, whereas 4 steps is usually sufficient for a decent image. The `go_fast` flag toggles a faster inference backend; if for some reason you want potentially more deterministic or slightly different results, you can try disabling it (which will use the original model weights at BF16 precision – slower, but might allow more steps for fine detail).

Finally, be aware of aspect ratio constraints: flux can generate various aspect ratios, but it still has a maximum resolution limit. Very large images (beyond \~1 megapixel for flux-dev on Replicate) aren’t supported directly. If you need higher resolution, you would either upscale the output afterward or use the Flux Pro or Ultra models (see below). Any invalid parameter (e.g., an unsupported aspect ratio string or format) will result in an error from the API. The response for errors will include an `error` field with a message; for example, an attempt to generate disallowed content might return a JSON error with a message about the safety system (content filter).

# Flux 1.1 \[pro] (Replicate)

**Model:** FLUX 1.1 \[pro] by Black Forest Labs on Replicate. This is an upgraded, production-grade version of the Flux model, offering faster generation and improved image quality compared to the \[dev] model. Flux 1.1 Pro is a **text-to-image model** known for excellent prompt adherence and diversity in outputs. (It’s the flagship model – often simply referred to as Flux Pro.)

**Input Parameters:**

* **`prompt`** (string, **required**): The description of the image to generate. Flux 1.1 Pro responds well to detailed prompts and can produce high-fidelity images from them. Like flux-dev, only positive prompts are supported (no dedicated negative prompt input).

* **`seed`** (integer, optional): Random seed for image generation. Same usage as in flux-dev – if you use the same seed and prompt, you’ll get deterministic output. Omit for random behavior.

* **`aspect_ratio`** (string, optional): The desired aspect ratio of the output. Defaults to `"1:1"` if not specified (for a square image). Flux 1.1 Pro supports flexible aspect ratios similar to flux-dev (common values like `"16:9"`, `"3:2"`, `"2:3"`, etc., are accepted). Under the hood, this will set appropriate width and height within the model’s limits.

  * **Resolution Constraints:** Flux 1.1 Pro can generate images up to roughly **1440px** on the long side (and minimum 256px on the short side), with dimensions needing to be multiples of 32. In practice, the Replicate implementation limits you to preset aspect ratios (rather than arbitrary pixel sizes) for simplicity. The model is optimized for \~1 megapixel outputs by default (e.g., 1024×1024 or equivalent), and larger outputs require the separate “ultra” model (Flux 1.1 Pro Ultra). So, if you need very high resolution (like 2048×... pixels), you’d use the ultra variant. The base Flux 1.1 Pro model here sticks to standard res.

* **`num_outputs`** (integer, optional): Number of images to generate (1–4, default 1) – same as flux-dev. Each output is an independent variation for the given prompt.

* **`output_format`** (string, optional): `"webp"`, `"png"`, or `"jpg"`; default `"webp"` (as with flux-dev). You can choose PNG for lossless output or JPG for broader compatibility, depending on your needs.

* **`output_quality`** (integer, optional): Quality setting for the output image (0–100, default 80). Functions the same way as in flux-dev.

* **`disable_safety_checker`** (boolean, optional): If `true`, disables the content safety filter. Default is `false` (safety on). Flux 1.1 Pro has strong prompt adherence, so it may produce disallowed content if prompted – the safety checker will normally catch and block that (returning an error). Only disable it if you are handling moderation yourself and accept that risk.

* **`prompt_upsampling`** (boolean, optional): **New in Flux 1.1 Pro.** If enabled (`true`), the model will use an internal large language model to **expand or enhance your prompt** before image generation. This “prompt upsampling” can add more descriptive detail to simple prompts. By default this is **off** (false) – meaning the model will use your prompt as given. You can turn it on to potentially get more varied or detailed interpretations of a short prompt. For example, if your prompt is just `"a bird"`, enabling prompt\_upsampling might cause the model to internally expand it to a richer description of a bird (leading to a more detailed image). *Quirk:* When this is enabled, the API might return an additional field `revised_prompt` or similar in the result, indicating what the model actually used after upsampling. (If your integration shows the “revised\_prompt”, it’s basically the elaborated prompt text.)

* **`go_fast`** (boolean, optional): Flux 1.1 Pro is inherently optimized for speed, so this flag may be present for consistency but effectively always true. In other words, the Pro model always runs in a fast mode. If the API accepts this parameter, leaving it as `true` (default) or omitting it is recommended. Setting it to `false` may not be supported (Flux 1.1 Pro doesn’t necessarily have a “slow” mode, since it was designed to be fast and efficient by default).

* **`guidance_scale`** (number, optional): This parameter may or may not be exposed; if it is, it controls the strength of the prompt guidance (CFG scale). For Flux 1.1 Pro, the default guidance scale is similarly around 3.5 (as with dev) if we assume the same setup. However, because negative prompts aren’t separately provided, most users won’t need to tweak this. If present, you could adjust it slightly (e.g., 1.0 would make the image less strictly following the prompt, >3.5 might enforce prompt details a bit more, but setting too high can degrade quality). In most cases, you can omit this and use the model’s default behavior.

* **`safety_tolerance`** (number or enum, optional): (Advanced) This is a moderation-related setting specific to the Pro model’s hosted API. It determines how lenient the content filter is. A lower tolerance means stricter filtering (fewer risky outputs), a higher tolerance allows more content through. The exact range isn’t well-documented, but it’s likely a value that the API uses internally for content moderation. By default, the model uses a standard safety tolerance (ensuring compliance with content policy). Only adjust this if you have access to BFL’s documentation and need to fine-tune moderation. On Replicate, this parameter may not be exposed at all – Replicate might simply enforce its own content rules. (If using BFL’s direct API, you might see this parameter.)

**Default Behavior:** By default, Flux 1.1 Pro will generate one image at \~1024×1024 (or equivalent) resolution from your prompt, in WebP format, quickly (about *six times faster* than the previous Pro model). It leverages improvements in architecture such that it achieves high quality in a small number of steps. The default `prompt_upsampling` is off, meaning it will use your prompt verbatim. The default safety settings will block disallowed prompts/outputs similarly to flux-dev (with an error message if triggered). If `aspect_ratio` is not provided, you get a square image. If an aspect ratio is provided, the model picks the largest resolution in that ratio that fits its constraints (for example, `"16:9"` might yield 1280×720 or similar). The pricing on Replicate is per image (\$0.04 per image for Flux 1.1 Pro as of late 2024), so requesting multiple outputs in one go multiplies cost linearly.

**Output Format:** Outputs are returned as URLs to image files (just like flux-dev). The images are high-quality raster images (not SVG). If `output_format` is a lossy format (webp or jpg), they are compressed with the specified quality. The model is known for producing **photorealistic and detailed images** given the right prompt – e.g., it can render faces, objects, and scenes with impressive fidelity relative to other open-source models. The output JSON from Replicate will not only include the image URL(s) but might also echo back your input parameters and include a `revised_prompt` if prompt upsampling was used (OpenAI’s Azure response example shows a `revised_prompt` field for DALL-E 3 which is analogous to what Flux’s upsampler might return).

**Example API Payload:** To call Flux 1.1 Pro via Replicate’s API, you could use a payload like the following:

```json
{
  "version": "<flux-1.1-pro-model-version-id>",
  "input": {
    "prompt": "A portrait of an astronaut swimming in a pool on the Moon, photo-realistic",
    "aspect_ratio": "3:4",
    "prompt_upsampling": false,
    "output_format": "jpg",
    "output_quality": 90
  }
}
```

This requests a single 3:4 portrait-oriented image (e.g. \~768×1024) as a high-quality JPEG. We explicitly turned off `prompt_upsampling` (though it’s off by default) to illustrate the parameter. The API would return a JSON with an `output` URL to the JPEG image. If the prompt were very short and you wanted the model to enhance it, you could set `"prompt_upsampling": true`. In that case, if the model’s LLM elaborates the prompt, the returned data might include something like `"revised_prompt": "A detailed studio photograph of an astronaut swimming in... (full expanded prompt)"`. The image generated would reflect that revised prompt.

**Quirks and Notes:** Flux 1.1 Pro aims to push the envelope on quality *and* speed. One quirk is that **some parameters from flux-dev are less relevant** here: for example, `go_fast` is essentially always true (the Pro model is inherently the “fast” version), and `megapixels` is fixed at \~1 for this model (for higher megapixels, use the Ultra model variant). Also, unlike many diffusion models, Flux 1.1 Pro introduced that prompt upsampling feature – which is somewhat unique in that it leverages a text model to help you craft a better prompt automatically. This can be very useful for short or underspecified prompts, but if your prompt is already very detailed, you might leave it off to avoid any unintended changes in meaning.

Another note: The **output diversity** is improved in Flux 1.1 Pro, meaning if you run the same prompt multiple times (with different seeds), you should get a wider range of interpretations compared to earlier models. This is great for creative exploration. However, prompt adherence is also strong, so most outputs will still closely match the request.

**Error handling:** If something goes wrong – e.g., your prompt violates terms – you’ll get an error JSON rather than an image. For instance, an error might look like this (from OpenAI’s API as an analogy):

```json
{
  "error": {
    "code": "contentFilter",
    "message": "Your task failed as a result of our safety system."
  }
}
```

. Ensure your integration checks for an `error` field in the response. The MCP server should catch exceptions and return a machine-readable error (with error code/message) so that the client can handle it. Logging should record whether the request succeeded or failed and any error messages (for monitoring and debugging). For flux models on Replicate, a failure might also occur if the service is overloaded or if parameters are out of range; those would return an `error` with a message from Replicate’s API.

# OpenAI GPT-4 Image Model (`gpt-image-1`)

**Model:** OpenAI’s new image generation model, known by the identifier `gpt-image-1`. This model (sometimes informally called “GPT-4 Vision for image generation” or “DALL-E 3 API”) is a multimodal model that can **generate images from text prompts**. It’s accessible via the OpenAI Images API endpoints and represents OpenAI’s latest image generation capabilities (as of 2024). It supports advanced features like prompt expansion, high resolution, and editing operations. Here we focus on the text-to-image generation parameters.

**Input Parameters (Generation):**

* **`model`** (string, optional): The model ID to use. In this case you would specify `"gpt-image-1"` to ensure you use this latest model. (If omitted, OpenAI might default to an older model like DALL-E, so it’s best to include it.)
* **`prompt`** (string, **required**): A text description of the desired image. This can be a single sentence or a detailed paragraph. The model is very capable of understanding nuanced prompts. For example: `"A steampunk city skyline at sunset, with airships in the sky"`. The better you describe the scene and style, the more it will adhere. Content is moderated: disallowed content in the prompt will result in an error rather than an image.
* **`n`** (integer, optional): The number of images to generate. You can request **1 to 10** images in one API call, similar to DALL-E’s API. Default is **1** if not specified. Each image beyond the first will cost additional tokens/credits. For example, `n: 3` would return an array of three generated images.
* **`size`** (string, optional): The desired resolution of the output image. Supported sizes for `gpt-image-1` are:

  * `"1024x1024"` (square),
  * `"1024x1536"` (portrait orientation, 3:4 aspect),
  * `"1536x1024"` (landscape orientation, 4:3 aspect).
    The default, if not provided, is **1024x1024** (the “auto” setting typically defaults to square). These are the maximum resolutions; you cannot request higher resolutions from this model via the API (e.g., 2048x2048 is not supported). If you need a different aspect ratio, you must choose the closest and then crop/pad externally. *Note:* The **generation speed** can depend on size — square images are generally fastest for this model.
* **`quality`** (string, optional): Controls the **detail level and token usage** for generation. Options: `"low"`, `"medium"`, `"high"`, or `"auto"`. Higher quality uses more compute (and more tokens, since the model internally uses more “image tokens” to render details). The default is `"auto"` which essentially means the model will default to the highest quality (“high/HD”) unless it decides otherwise. In the official API docs, the quality might also be referred to as `"standard"` vs `"hd"` – for practical purposes, use `"high"` or `"hd"` for the best quality. If you want faster, cheaper generation and can accept simpler images, you could use `"medium"` or `"low"`. For example, `quality: "low"` greatly reduces detail (and cost).
* **`style`** (string, optional): Adjusts the overall style/tone of the image. Current known options include `"vivid"` and `"natural"`.

  * `"vivid"` produces more vibrant colors and perhaps a more artistic or fantastical style.
  * `"natural"` aims for a more realistic, muted palette and authentic look.
    If not provided, the model will choose a style appropriate to the prompt (or a neutral style). This is a high-level control; you can also influence style via the prompt itself. (This parameter is akin to presets; e.g., ChatGPT’s interface might call these “Creative” vs “Realistic” modes.)
* **`output_format`** (string, optional): The file format of the generated image. Options include `"png"`, `"jpeg"`, or `"webp"`. By default, OpenAI’s API tends to return **PNG** for images (especially since `gpt-image-1` supports transparency). Specify `output_format` if you need a specific format:

  * Use `"png"` if you want lossless images or need transparency.
  * Use `"jpeg"` if you prefer a widely supported format (no transparency, lossy).
  * Use `"webp"` for a modern, compressed format that supports transparency and good compression.
    If not set, you will typically get PNG with this model (which was a change from the older DALL-E which returned URLs to PNG by default).
* **`output_compression`** (integer, optional): Quality setting for JPEG or WebP outputs. Ranges 0–100, where 100 means no compression (best quality, largest file) and 0 would be maximum compression (lowest quality). Default is around 75–80 if not specified. This has no effect on `png` (which is lossless). For example, you might set `output_compression: 50` for a smaller WebP file at some quality loss.
* **`background`** (string, optional): Controls the background transparency. To get a transparent background, set `"background": "transparent"`. This is only honored if `output_format` is `"png"` (or WebP) which support transparency. By default, or if using JPEG, the background will be filled in (usually with a neutral or white background). Use case: if you prompt for an object and want no background, you can request a transparent PNG. (The model has been specifically updated to handle text and transparency better.)
* **`response_format`** (string, optional): Specifies how the image should be returned. Options: `"url"` or `"b64_json"`. In older image APIs, default was `"url"` (the response would contain a temporary URL to the image file). For `gpt-image-1`, the model **always returns base64-encoded images** in JSON by default, so this parameter may be ignored or only one format is supported. (OpenAI’s Python library notes that `gpt-image-1` returns base64 by default for the images.) To be safe, you can set `response_format: "b64_json"` to get the image bytes encoded in the JSON response. If you prefer URLs, you could try `response_format: "url"`, but if the API doesn’t support it, it will throw an error. Check OpenAI’s latest documentation – as of now, expect base64 JSON and handle accordingly (your server might need to convert that to an actual image file or data URI).
* **`user`** (string, optional): An arbitrary identifier for the end-user. OpenAI recommends sending a `user` ID in requests to help with abuse detection and rate limiting. For example, `"user": "alice123"`. This doesn’t affect the image generation, but is useful for logging and tracking in a multi-user environment. Your MCP server can set this to an ID if known; otherwise it can be omitted.
* **`moderation`** (string, optional): Adjusts the level of content filtering. Options are `"auto"` (default) and `"low"`.

  * `"auto"` is the normal strict filtering.
  * `"low"` reduces the strictness somewhat (allowing more borderline content through).
    The default “auto” will block anything against OpenAI’s content policy with standard thresholds. Setting `moderation: "low"` might allow, for instance, artistic nudity or slightly edgy content that the higher setting might flag – but it **will not** allow outright disallowed content (the model still won’t produce violent/sexual extremist content, etc.). Use `"low"` only if you have a use case that requires fewer false positives and you’re still following usage policies. If content is flagged even on low, the API returns an error (similar to the `error` examples above with code `"contentFilter"`).

**Default Behavior:** By default, a call to `gpt-image-1` with just a prompt (and perhaps model name) will produce **one 1024×1024 image** at high quality in PNG format, and return it as base64 JSON. The output will have any background as non-transparent unless the prompt specifically implies transparency (the model may infer transparency if asked for an icon/logo with no background, but to be sure you’d set `background: transparent`). The model will automatically handle your prompt: it may even internally rewrite or refine it (OpenAI has hinted at using GPT-4 internally to understand context, similar to how DALL-E 3 works within ChatGPT). You might notice the response includes a `revised_prompt` field – that’s the model’s final interpreted prompt. For example, the response could be:

```json
{
  "created": 1700000000,
  "data": [
    {
      "b64_json": "<BASE64_IMAGE_DATA>",
      "revised_prompt": "An astronaut with a mirrored helmet swimming in a pool on the moon, photograph, extremely detailed, stars in background"
    }
  ]
}
```

The **revised\_prompt** (if present) shows how the model expanded your request for better image fidelity. This is analogous to Flux’s prompt upsampling but here it’s done automatically. If your prompt was already detailed, the revision might just be the same as input.

**Output Format:** As noted, the API response will likely contain the image in base64 form. Your server (the Cloudflare Worker) should decode that and either pass it through or convert it to an image file depending on the MCP client’s needs. The model’s outputs are typically very detailed. It can also produce text in images fairly well (e.g., signage, logos with text) – a known improvement over older models. If multiple images are requested (`n>1`), the response will include an array under `data`, each with its own `b64_json` (or `url`) entry. Each image generation is independent but all are based on the same prompt (the model does not do variations in one call – for variations there’s a separate endpoint).

**Example API Payload:** Using OpenAI’s REST API, a JSON body for generating an image might look like:

```json
POST https://api.openai.com/v1/images/generations
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "model": "gpt-image-1",
  "prompt": "A majestic unicorn in a magical forest, fantasy art, glowing lights",
  "n": 2,
  "size": "1024x1536",
  "quality": "high",
  "response_format": "b64_json"
}
```

This request asks for 2 images (`n:2`) of size 1024×1536 (portrait) at high quality. In the response, you would get something like:

```json
{
  "created": 1700000123,
  "data": [
    {"b64_json": "<base64 data for image1>"},
    {"b64_json": "<base64 data for image2>"}
  ]
}
```

If instead you set `response_format: "url"`, you’d expect:

```json
"data": [
  {"url": "https://openai.azure.com/.../generated-image1.png"},
  {"url": "https://openai.azure.com/.../generated-image2.png"}
]
```

(Each URL would be a temporary link valid for perhaps 24 hours, as was the case in earlier OpenAI image APIs.) However, again, for `gpt-image-1` the base64 response is typical.

**Quirks and Notes:** The GPT-4 image model has some special capabilities:

* It **renders text in images** more reliably than previous models (you can actually ask for signage, logos with specific words, etc., and it will often succeed).
* It supports **image edits and variations** via separate endpoints (`/images/edits` and `/images/variations`), which require additional fields like an input image, a mask, etc. (For example, editing requires an `image` file and a `mask` file in addition to the prompt). Those tools would have schemas for `image` (the base image to edit) and optional `mask` and `prompt` for what to change. Since the question is about image generation, we won’t digress into the edit/variation inputs, but be aware they exist.
* **Transparent background**: If you need transparency, you must request `output_format="png"` and `background="transparent"`. The model can then produce an image where the background pixels are alpha-transparent. This is great for creating assets (like sprites or icons) that can be overlaid on other images.
* **Latency and cost**: Generating a 1024×1024 high-quality image might take a handful of seconds. Larger or multiple images take longer. Each “image token” consumed counts against your model usage. OpenAI might charge per image or per pixel. (For instance, the model context length might effectively be those image tokens: a 1024×1024 image at high quality was noted to consume *272 tokens* for low quality up to *400+ tokens* for high quality in the system – these refer to internal tokens used, not prompt tokens.)
* **Error handling**: If your prompt is flagged by moderation, you’ll get an error with `error.code = "contentFilter"` and a message. If the image generation itself produces disallowed content (even if prompt seemed okay), the response will similarly have an error: `"Generated image was filtered as a result of our safety system."`. Your server should catch these and relay a structured error. The client can then decide how to proceed (maybe show a user-facing message, etc.). All such errors are JSON with an `error` object, so they are machine-readable.
* OpenAI’s image model (like DALL-E 3) does some prompt interpretation. It might ignore parts of the prompt it deems unsafe or inject subtle changes to avoid disallowed content. For example, if you ask for a political figure in a controversial setting, it may either refuse or modify the request internally to a safer version (which might be reflected in `revised_prompt`). It’s a bit of a black box, so what you get is subject to the model’s and OpenAI’s safety system’s judgement. Logging the `revised_prompt` (when present) and the final outcome can be helpful for debugging why an image might not match the user’s original prompt exactly.
* **Logging and Configuration**: Since this MCP server is on Cloudflare Workers, you’ll have environment variables for the OpenAI API key and any other config (like a default Org ID or the server name). Make sure to log the tool name (`generate-openai`), the prompt (or a sanitized version), parameters like size/quality, and whether the request succeeded. Do not log the actual base64 image (too large and unnecessary), but do log error messages. This structured logging will help monitor usage and issues.

Overall, `gpt-image-1` is a powerful model that should be integrated carefully, respecting the user’s prompt while abiding by the content policy. Each of the above parameters maps directly to the OpenAI API fields, so your tool implementation will take the user’s input (from the MCP client) and plug them into the JSON body for the OpenAI request. The server’s response then needs to be parsed and returned to the client in the MCP format. By documenting these parameters and behaviors, the tool definitions will enable clients to use each image generation model (`generate-svg`, `generate-fluxdev`, `generate-fluxpro`, `generate-openai`) correctly and handle their outputs and errors robustly.

**Sources:**

* Recraft V3 SVG model info (input parameters and style options).
* Flux \[dev] and \[pro] model docs and examples.
* Black Forest Labs announcements and community discussions on Flux guidance scale.
* OpenAI image generation API documentation and third-party guides.


So how would you do the actual cloudflare portion?

// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { z } from "zod";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY;

const server = new McpServer({ name: "ImageGenMCP", version: "1.0.0" });

// Helper to fetch from Replicate
async function callReplicate(model: string, version: string, input: Record<string, any>) {
  const response = await fetch(`https://api.replicate.com/v1/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Token ${REPLICATE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ version, input }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Replicate call failed");
  return result.output;
}

// Helper to call OpenAI Image API
async function callOpenAIImage(input: Record<string, any>) {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      response_format: "b64_json",
      ...input,
    }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || "OpenAI call failed");
  return result.data;
}

// Tool: generate-openai
server.tool("generate-openai", {
  inputSchema: z.object({
    prompt: z.string(),
    n: z.number().min(1).max(10).optional(),
    size: z.enum(["1024x1024", "1024x1536", "1536x1024"]).optional(),
    quality: z.enum(["low", "medium", "high", "auto"]).optional(),
    style: z.enum(["vivid", "natural"]).optional(),
    background: z.enum(["transparent", "white"]).optional(),
  }),
  execute: async ({ input }) => {
    const result = await callOpenAIImage(input);
    return { result };
  },
});

// Tool: generate-svg
server.tool("generate-svg", {
  inputSchema: z.object({
    prompt: z.string(),
    size: z.string().optional(),
    style: z.enum(["any", "engraving", "line_art", "line_circuit", "linocut"]).optional(),
  }),
  execute: async ({ input }) => {
    const result = await callReplicate(
      "recraft-ai/recraft-v3-svg",
      "REPLACE_WITH_MODEL_VERSION",
      input
    );
    return { result };
  },
});

// Tool: generate-fluxdev
server.tool("generate-fluxdev", {
  inputSchema: z.object({
    prompt: z.string(),
    aspect_ratio: z.string().optional(),
    num_outputs: z.number().min(1).max(4).optional(),
    output_format: z.enum(["webp", "png", "jpg"]).optional(),
    output_quality: z.number().min(1).max(100).optional(),
    seed: z.number().optional(),
    go_fast: z.boolean().optional(),
  }),
  execute: async ({ input }) => {
    const result = await callReplicate(
      "black-forest-labs/flux-dev",
      "REPLACE_WITH_MODEL_VERSION",
      input
    );
    return { result };
  },
});

// Tool: generate-fluxpro
server.tool("generate-fluxpro", {
  inputSchema: z.object({
    prompt: z.string(),
    aspect_ratio: z.string().optional(),
    num_outputs: z.number().min(1).max(4).optional(),
    output_format: z.enum(["webp", "png", "jpg"]).optional(),
    output_quality: z.number().min(1).max(100).optional(),
    seed: z.number().optional(),
    prompt_upsampling: z.boolean().optional(),
    disable_safety_checker: z.boolean().optional(),
  }),
  execute: async ({ input }) => {
    const result = await callReplicate(
      "black-forest-labs/flux-1.1-pro",
      "REPLACE_WITH_MODEL_VERSION",
      input
    );
    return { result };
  },
});

export default server.export();
