# MARTINS.js WebAR engine

[![GitHub release (latest by date)](https://img.shields.io/github/v/release/alemart/martins-js)](https://github.com/alemart/martins-js/releases/) ![GitHub file size in bytes on a specified ref (branch/commit/tag)](https://img.shields.io/github/size/alemart/martins-js/dist/martins.min.js?branch=master&label=minified%20js) [![GitHub Repo stars](https://img.shields.io/github/stars/alemart/martins-js?logo=github)](https://github.com/alemart/martins-js/stargazers) [![GitHub Sponsors](https://img.shields.io/github/sponsors/alemart?logo=github)](https://github.com/sponsors/alemart/)

Create amazing Augmented Reality experiences with **MARTINS.js**, a GPU-accelerated Augmented Reality engine for the web. Users don't need specialized hardware nor dedicated software - only a modern web browser.

[**Try a demo**](#try-webar-right-now) | [**:heart: Support my work!**](https://alemart.github.io/martins-js/support-my-work)

:man_technologist: MARTINS.js is developed by [Alexandre Martins](https://github.com/alemart) and is based on [Speedy Vision](https://github.com/alemart/speedy-vision).

:books: Technical documentation is available at <https://alemart.github.io/martins-js/>.

## Try WebAR right now!

1. Scan or tap the QR code below with a mobile device.
2. A [web page](https://alemart.github.io/martins-js/demo/) will be opened. It's the WebAR experience.
3. The web page will request access to your webcam. Authorize it.
4. Scan the cartoon below.
5. Enjoy! :wink:

>
> **Guidelines for WebAR:**
>
> - WebGL2 and WebAssembly are required. Use a [compatible browser](#browser-compatibility).
> - Don't move the camera too quickly - it produces motion blur.
> - The physical environment should be properly illuminated.
> - Avoid low-quality cameras (cameras of common smartphones are OK).
>

[![WebAR demo](https://alemart.github.io/martins-js/demo/reference-image-with-qr-code.webp)](https://alemart.github.io/martins-js/demo/)

Visit the [Demo gallery](https://alemart.github.io/martins-js/gallery/) for more.

## Try locally

Try the demos on your own machine:

1. Run on a console:

```sh
git clone git@github.com:alemart/martins-js.git
cd martins-js
npm start
```

2. Open https://localhost:8000/demos/
3. Pick a demo and have fun!

## Features

* **Image tracking**, also known as natural feature tracking. Use it to track detailed images such as: book covers, cartoons and photos.

## What can you do with Web-based Augmented Reality?

Lots of exciting things that run in the web browser! No need to install apps!

* WebAR games
* Marketing gimmicks
* Interactive art
* Tech demos
* ...and more!

## Why use MARTINS.js?

Here is why MARTINS.js is a great choice for creating Augmented Reality experiences:

* **No need to download apps!** MARTINS.js is a WebAR engine. It runs in web browsers. Users can access the AR experience immediately.
* **Fast and powerful!** MARTINS.js is GPU-accelerated. It uses WebGL2 and WebAssembly for turbocharged performance.
* **No need of custom hardware or software!** MARTINS.js is built from scratch using standard web technologies. All it requires is a modern web browser.
* **Fully standalone!** MARTINS.js has in it everything it needs to analyze the environment and help you create AR. There are no additional requirements. No need of WebXR.
* **Easy to get started!** MARTINS.js can be used with a `<script>` tag in your page. A static HTML page is enough to get started.

## Browser compatibility

MARTINS.js is compatible with all major web browsers:

| Chrome | Edge | Firefox | Opera | Safari* |
| ------ | ---- | ------- | ----- | ------- |
| ✔      | ✔    | ✔       | ✔     | ✔       |

\* use Safari 15.2 or later.

MARTINS.js requires WebGL2 and WebAssembly.

## License

Released under the [AGPL 3.0](LICENSE.md). A different license is available if you [support my work](https://alemart.github.io/martins-js/support-my-work).