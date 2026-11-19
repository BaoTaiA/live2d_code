(function () {
	const script = document.currentScript;
	if (!script || !script.src) {
		return;
	}

	const live2d_path = new URL(".", script.src).href;

	const side = (script.getAttribute("data-side") || "").trim().toLowerCase();
	if (side === "right") {
		document.documentElement.classList.add("waifu-side-right");
	}

	function loadExternalResource(url, type) {
		return new Promise((resolve, reject) => {
			let tag;

			if (type === "css") {
				tag = document.createElement("link");
				tag.rel = "stylesheet";
				tag.href = url;
			}
			else if (type === "js") {
				tag = document.createElement("script");
				tag.src = url;
			}
			if (tag) {
				tag.onload = () => resolve(url);
				tag.onerror = () => reject(url);
				document.head.appendChild(tag);
			}
		});
	}

	function loadScriptsSequential(baseHref, filenames) {
		let chain = Promise.resolve();
		for (let i = 0; i < filenames.length; i++) {
			const name = filenames[i];
			chain = chain.then(() => loadExternalResource(new URL(name, baseHref).href, "js"));
		}
		return chain;
	}

	if (screen.width >= 768) {
		const widgetOptions = {
			waifuPath: new URL("waifu-tips.json", live2d_path).href,
			assetBase: live2d_path,
			tools: ["hitokoto", "asteroids", "switch-model", "switch-texture", "info", "photo", "quit"]
		};
		const apiPath = script.getAttribute("apiPath");
		const cdnPath = script.getAttribute("cdnPath");
		if (apiPath) {
			widgetOptions.apiPath = apiPath;
		}
		if (cdnPath) {
			widgetOptions.cdnPath = cdnPath;
		}

		const kitScripts = ["waifu-bundle.js", "waifu-app.js"];

		Promise.all([
			loadExternalResource(new URL("waifu.css", live2d_path).href, "css"),
			loadExternalResource(new URL("live2d.min.js", live2d_path).href, "js")
		]).then(() => loadScriptsSequential(live2d_path, kitScripts)).then(() => {
			initWidget(widgetOptions);
		}).catch(() => {});
	}
}());
console.log(`
	●__●
	│__│
	/  \\
	Live_2D
  `);
