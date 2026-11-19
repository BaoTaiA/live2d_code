/**
 * 看板娘入口：组装 WaifuKit 模块与 UI / 加载逻辑
 */
var waifuScriptBase = document.currentScript && document.currentScript.src
    ? new URL(".", document.currentScript.src).href
    : "";

function loadWidget(config) {
    var WK = window.WaifuKit;
    var waifuPath = config.waifuPath,
        apiPath = config.apiPath,
        cdnPath = config.cdnPath,
        toolsConfig = config.tools,
        assetBase = config.assetBase;
    WK.setScriptBase(assetBase || waifuScriptBase);

    var useCDN = false,
        modelList,
        modelSizes = {},
        apiModels = null,
        waifuActiveRuntime = null;

    if (typeof cdnPath === "string") {
        useCDN = true;
        if (!cdnPath.endsWith("/")) cdnPath += "/";
    } else if (typeof apiPath === "string") {
        if (!apiPath.endsWith("/")) apiPath += "/";
    } else {
        console.error("Invalid initWidget argument!");
        return;
    }

    localStorage.removeItem("waifu-display");
    sessionStorage.removeItem("waifu-text");
    document.body.insertAdjacentHTML("beforeend", '<div id="waifu"><div id="waifu-tips"></div><canvas id="live2d" width="800" height="800"></canvas><div id="waifu-tool"></div></div>');
    setTimeout(function () {
        document.getElementById("waifu").style.bottom = 0;
    }, 0);

    function randomSelection(obj) {
        return Array.isArray(obj) ? obj[Math.floor(Math.random() * obj.length)] : obj;
    }
    var userAction = false,
        userActionTimer,
        messageTimer,
        messageArray = ["好久不见，日子过得好快呢……", "大坏蛋！你都多久没理人家了呀，嘤嘤嘤～", "嗨～快来逗我玩吧！", "拿小拳拳锤你胸口！"];
    window.addEventListener("mousemove", function () {
        userAction = true;
    });
    window.addEventListener("keydown", function () {
        userAction = true;
    });
    setInterval(function () {
        if (userAction) {
            userAction = false;
            clearInterval(userActionTimer);
            userActionTimer = null;
        } else if (!userActionTimer) {
            userActionTimer = setInterval(function () {
                showMessage(randomSelection(messageArray), 6000, 9);
            }, 20000);
        }
    }, 1000);

    function showMessage(text, timeout, priority) {
        var curPri = sessionStorage.getItem("waifu-text");
        if (!text || (curPri && curPri > priority)) return;
        if (messageTimer) {
            clearTimeout(messageTimer);
            messageTimer = null;
        }
        text = randomSelection(text);
        sessionStorage.setItem("waifu-text", priority);
        var tips = document.getElementById("waifu-tips");
        tips.innerHTML = text;
        tips.classList.add("waifu-tips-active");
        messageTimer = setTimeout(function () {
            sessionStorage.removeItem("waifu-text");
            tips.classList.remove("waifu-tips-active");
        }, timeout);
    }

    function showHitokoto() {
        fetch("https://v1.hitokoto.cn").then(function (response) {
            return response.json();
        }).then(function (result) {
            var text = "这句一言来自<span>「" + result.from + "」</span>，是<span>" + result.creator + "</span>在 hitokoto.cn 投稿的。";
            showMessage(result.hitokoto, 6000, 9);
            setTimeout(function () {
                showMessage(text, 4000, 9);
            }, 6000);
        });
    }

    function mountWaifuTools() {
        var toolDefs = {
            hitokoto: {
                icon: '<svg viewBox="0 0 512 512"><path d="M512 240c0 114.9-114.6 208-256 208c-37.1 0-72.3-6.4-104.1-17.9c-11.9 8.7-31.3 20.6-54.3 30.6C73.6 471.1 44.7 480 16 480c-6.5 0-12.3-3.9-14.8-9.9c-2.5-6-1.1-12.8 3.4-17.4l0 0 0 0 0 0 0 0 .3-.3c.3-.3 .7-.7 1.3-1.4c1.1-1.2 2.8-3.1 4.9-5.7c4.1-5 9.6-12.4 15.2-21.6c10-16.6 19.5-38.4 21.4-62.9C17.7 326.8 0 285.1 0 240C0 125.1 114.6 32 256 32s256 93.1 256 208z"/></svg>',
                click: showHitokoto
            },
            asteroids: {
                icon: '<svg viewBox="0 0 512 512"><path d="M498.1 5.6c10.1 7 15.4 19.1 13.5 31.2l-64 416c-1.5 9.7-7.4 18.2-16 23s-18.9 5.4-28 1.6L277.3 424.9l-40.1 74.5c-5.2 9.7-16.3 14.6-27 11.9S192 499 192 488V392c0-5.3 1.8-10.5 5.1-14.7L362.4 164.7c2.5-7.1-6.5-14.3-13-8.4L170.4 318.2l-32 28.9 0 0c-9.2 8.3-22.3 10.6-33.8 5.8l-85-35.4C8.4 312.8 .8 302.2 .1 290s5.5-23.7 16.1-29.8l448-256c10.7-6.1 23.9-5.5 34 1.4z"/></svg>',
                click: function () {
                    if (window.Asteroids) {
                        if (!window.ASTEROIDSPLAYERS) window.ASTEROIDSPLAYERS = [];
                        window.ASTEROIDSPLAYERS.push(new Asteroids());
                    } else {
                        var script = document.createElement("script");
                        script.src = waifuScriptBase ? new URL("asteroids.js", waifuScriptBase).href : "asteroids.js";
                        document.head.appendChild(script);
                    }
                }
            },
            "switch-model": {
                icon: '<svg viewBox="0 0 512 512"><path d="M399 384.2C376.9 345.8 335.4 320 288 320H224c-47.4 0-88.9 25.8-111 64.2c35.2 39.2 86.2 63.8 143 63.8s107.8-24.7 143-63.8zM512 256c0 141.4-114.6 256-256 256S0 397.4 0 256S114.6 0 256 0S512 114.6 512 256zM256 272c39.8 0 72-32.2 72-72s-32.2-72-72-72s-72 32.2-72 72s32.2 72 72 72z"/></svg>',
                click: function () {
                    loadOtherModel();
                }
            },
            "switch-texture": {
                icon: '<svg viewBox="0 0 512 512"><path d="M320 64c0-35.3-28.7-64-64-64s-64 28.7-64 64s28.7 64 64 64s64-28.7 64-64zm-96 96c-35.3 0-64 28.7-64 64v48c0 17.7 14.3 32 32 32h1.8l11.1 99.5c1.8 16.2 15.5 28.5 31.8 28.5h38.7c16.3 0 30-12.3 31.8-28.5L318.2 304H320c17.7 0 32-14.3 32-32V224c0-35.3-28.7-64-64-64H224zM132.3 394.2c13-2.4 21.7-14.9 19.3-27.9s-14.9-21.7-27.9-19.3c-32.4 5.9-60.9 14.2-82 24.8c-10.5 5.3-20.3 11.7-27.8 19.6C6.4 399.5 0 410.5 0 424c0 21.4 15.5 36.1 29.1 45c14.7 9.6 34.3 17.3 56.4 23.4C130.2 504.7 190.4 512 256 512s125.8-7.3 170.4-19.6c22.1-6.1 41.8-13.8 56.4-23.4c13.7-8.9 29.1-23.6 29.1-45c0-13.5-6.4-24.5-14-32.6c-7.5-7.9-17.3-14.3-27.8-19.6c-21-10.6-49.5-18.9-82-24.8c-13-2.4-25.5 6.3-27.9 19.3s6.3 25.5 19.3 27.9c30.2 5.5 53.7 12.8 69 20.5c3.2 1.6 5.8 3.1 7.9 4.5c3.6 2.4 3.6 7.2 0 9.6c-8.8 5.7-23.1 11.8-43 17.3C374.3 457 318.5 464 256 464s-118.3-7-157.7-17.9c-19.9-5.5-34.2-11.6-43-17.3c-3.6-2.4-3.6-7.2 0-9.6c2.1-1.4 4.8-2.9 7.9-4.5c15.3-7.7 38.8-14.9 69-20.5z"/></svg>',
                click: function () {
                    loadRandModel();
                }
            },
            photo: {
                icon: '<svg viewBox="0 0 512 512"><path d="M220.6 121.2L271.1 96 448 96v96H333.2c-21.9-15.1-48.5-24-77.2-24s-55.2 8.9-77.2 24H64V128H192c9.9 0 19.7-2.3 28.6-6.8zM0 128V416c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V96c0-35.3-28.7-64-64-64H271.1c-9.9 0-19.7 2.3-28.6 6.8L192 64H160V48c0-8.8-7.2-16-16-16H80c-8.8 0-16 7.2-16 16l0 16C28.7 64 0 92.7 0 128zM344 304c0 48.6-39.4 88-88 88s-88-39.4-88-88s39.4-88 88-88s88 39.4 88 88z"/></svg>',
                click: function () {
                    showMessage("照好了嘛，是不是很可爱呢？", 6000, 9);
                    if (waifuActiveRuntime === "moc3") {
                        if (!WK.moc3Runtime.capturePhoto()) showMessage("截图失败，请稍后再试或检查控制台。", 4000, 10);
                        return;
                    }
                    if (window.Live2D && typeof window.Live2D.captureFrame !== "undefined") {
                        window.Live2D.captureName = "photo.png";
                        window.Live2D.captureFrame = true;
                    }
                }
            },
            info: {
                icon: '<svg viewBox="0 0 512 512"><path d="M256 512c141.4 0 256-114.6 256-256S397.4 0 256 0S0 114.6 0 256S114.6 512 256 512zM216 336h24V272H216c-13.3 0-24-10.7-24-24s10.7-24 24-24h48c13.3 0 24 10.7 24 24v88h8c13.3 0 24 10.7 24 24s-10.7 24-24 24H216c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-144c-17.7 0-32-14.3-32-32s14.3-32 32-32s32 14.3 32 32s-14.3 32-32 32z"/></svg>',
                click: function () {
                    open("https://tiax.cn");
                }
            },
            quit: {
                icon: '<svg viewBox="0 0 320 512"><path d="M310.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L160 210.7 54.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L114.7 256 9.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L160 301.3 265.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L205.3 256 310.6 150.6z"/></svg>',
                click: function () {
                    localStorage.setItem("waifu-display", Date.now());
                    showMessage("愿你有一天能与重要的人重逢。", 2000, 11);
                    document.getElementById("waifu").style.bottom = "-500px";
                    setTimeout(function () {
                        document.getElementById("waifu").style.display = "none";
                        document.getElementById("waifu-toggle").classList.add("waifu-toggle-active");
                    }, 3000);
                }
            }
        };
        var order = Array.isArray(toolsConfig) && toolsConfig.length ? toolsConfig : ["hitokoto", "asteroids", "switch-model", "switch-texture", "photo", "quit"];
        var root = document.getElementById("waifu-tool");
        for (var ti = 0; ti < order.length; ti++) {
            var key = order[ti];
            var def = toolDefs[key];
            if (!def) continue;
            var span = document.createElement("span");
            span.id = "waifu-tool-" + key;
            span.innerHTML = def.icon;
            span.addEventListener("click", def.click);
            root.appendChild(span);
        }
    }
    mountWaifuTools();

    async function loadModelList() {
        var response = await fetch(cdnPath + "model_list.json");
        modelList = await response.json();
    }

    /** 静态 index3.json 内多为相对路径，补成绝对 URL 供 Pixi Cubism4 拉取 */
    function rewriteMoc3JsonPathsToAbsolute(json, baseHref) {
        var base = String(baseHref || "").replace(/\/?$/, "/");
        var fr = json && json.FileReferences;
        if (!fr || typeof fr !== "object") return;
        function abs(u) {
            if (u == null || typeof u !== "string") return u;
            if (/^https?:\/\//i.test(u)) return u;
            try {
                return new URL(u, base).href;
            } catch (eAbs) {
                return base + u.replace(/^\//, "");
            }
        }
        if (fr.Moc) fr.Moc = abs(fr.Moc);
        if (Array.isArray(fr.Textures)) {
            for (var ti = 0; ti < fr.Textures.length; ti++) {
                fr.Textures[ti] = abs(fr.Textures[ti]);
            }
        }
        if (fr.Physics) fr.Physics = abs(fr.Physics);
        if (fr.Pose) fr.Pose = abs(fr.Pose);
        if (fr.Motions && typeof fr.Motions === "object") {
            var gk = Object.keys(fr.Motions);
            for (var gi = 0; gi < gk.length; gi++) {
                var list = fr.Motions[gk[gi]];
                if (!Array.isArray(list)) continue;
                for (var mi = 0; mi < list.length; mi++) {
                    var it = list[mi];
                    if (it && it.File) it.File = abs(it.File);
                }
            }
        }
        if (Array.isArray(fr.Expressions)) {
            for (var ei = 0; ei < fr.Expressions.length; ei++) {
                var ex = fr.Expressions[ei];
                if (ex && ex.File) ex.File = abs(ex.File);
            }
        }
        if (fr.UserData) fr.UserData = abs(fr.UserData);
    }

    async function loadModel(modelId, modelTexturesId, message) {
        localStorage.setItem("modelId", modelId);
        localStorage.setItem("modelTexturesId", modelTexturesId);
        if (message != null) showMessage(message, 4000, 10);
        if (useCDN) {
            if (!modelList) await loadModelList();
            var target = randomSelection(modelList.models[modelId]);
            if (WK.apiModel.isMoc3Key(target)) {
                var moc3Base = cdnPath + "model/" + target + "/";
                var moc3Url = moc3Base + "index3.json";
                try {
                    var resM = await fetch(moc3Url);
                    if (!resM.ok) throw new Error("fetch index3 " + resM.status);
                    var j3 = await resM.json();
                    j3.url = moc3Url;
                    rewriteMoc3JsonPathsToAbsolute(j3, moc3Base);
                    WK.canvas.applyModelSize("live2d", modelSizes, target, true);
                    await WK.moc3Runtime.load(j3);
                    waifuActiveRuntime = "moc3";
                    console.log("Live2D MOC3 CDN " + target);
                } catch (errM) {
                    console.error("MOC3 CDN 加载失败", target, errM);
                    await WK.moc3Runtime.destroy();
                    showMessage("MOC3 模型加载失败，请打开控制台查看。", 5000, 10);
                }
            } else {
                await WK.moc3Runtime.destroy();
                WK.canvas.applyModelSize("live2d", modelSizes, target, false);
                loadlive2d("live2d", cdnPath + "model/" + target + "/index.json");
                waifuActiveRuntime = "moc2";
                console.log("Live2D MOC2 CDN " + target);
            }
        } else {
            var modelKey = WK.apiModel.resolveKey(apiModels, modelId, modelTexturesId);
            if (WK.apiModel.isMoc3Key(modelKey)) {
                var loadUrl = apiPath + "get/?id=" + modelId + "-" + modelTexturesId;
                try {
                    var res = await fetch(loadUrl);
                    if (!res.ok) throw new Error("get " + res.status);
                    var json = await res.json();
                    json.url = loadUrl;
                    WK.canvas.applyModelSize("live2d", modelSizes, modelKey, true);
                    await WK.moc3Runtime.load(json);
                    waifuActiveRuntime = "moc3";
                    console.log("Live2D MOC3 " + modelId + "-" + modelTexturesId + " OK | API get");
                } catch (err) {
                    console.error("MOC3 加载失败", modelKey, err);
                    await WK.moc3Runtime.destroy();
                    showMessage("MOC3 模型加载失败，请打开控制台查看。", 5000, 10);
                }
            } else {
                var prevMoc3 = waifuActiveRuntime === "moc3";
                await WK.moc3Runtime.destroy();
                var loadUrl2 = apiPath + "get/?id=" + modelId + "-" + modelTexturesId;
                WK.canvas.applyModelSize("live2d", modelSizes, modelKey, prevMoc3);
                loadlive2d("live2d", loadUrl2);
                waifuActiveRuntime = "moc2";
                console.log("Live2D MOC2 " + modelId + "-" + modelTexturesId + " OK");
            }
        }
    }

    async function loadRandModel() {
        var modelId = localStorage.getItem("modelId"),
            modelTexturesId = localStorage.getItem("modelTexturesId");
        if (useCDN) {
            if (!modelList) await loadModelList();
            var targetR = randomSelection(modelList.models[modelId]);
            if (WK.apiModel.isMoc3Key(targetR)) {
                var moc3BaseR = cdnPath + "model/" + targetR + "/";
                var moc3UrlR = moc3BaseR + "index3.json";
                try {
                    var resR = await fetch(moc3UrlR);
                    if (!resR.ok) throw new Error("fetch index3 " + resR.status);
                    var j3r = await resR.json();
                    j3r.url = moc3UrlR;
                    rewriteMoc3JsonPathsToAbsolute(j3r, moc3BaseR);
                    WK.canvas.applyModelSize("live2d", modelSizes, targetR, true);
                    await WK.moc3Runtime.load(j3r);
                    waifuActiveRuntime = "moc3";
                } catch (errR) {
                    console.error("MOC3 CDN 随机皮肤失败", targetR, errR);
                    await WK.moc3Runtime.destroy();
                }
            } else {
                await WK.moc3Runtime.destroy();
                WK.canvas.applyModelSize("live2d", modelSizes, targetR, false);
                loadlive2d("live2d", cdnPath + "model/" + targetR + "/index.json");
                waifuActiveRuntime = "moc2";
            }
            showMessage("我的新衣服好看吗？", 4000, 10);
        } else {
            var mkRand = WK.apiModel.resolveKey(apiModels, modelId, modelTexturesId);
            if (WK.apiModel.isMoc3Key(mkRand)) {
                var slot = WK.apiModel.getSlot(apiModels, modelId);
                var newTid = WK.apiModel.pickRandTextureIdInSlot(slot, modelTexturesId);
                if (newTid == null) {
                    showMessage("我还没有其他衣服呢！", 4000, 10);
                    return;
                }
                loadModel(modelId, newTid, "我的新衣服好看吗？");
                return;
            }
            fetch(apiPath + "rand_textures/?id=" + modelId + "-" + modelTexturesId).then(function (response) {
                return response.json();
            }).then(function (result) {
                if (result.textures.id === 1 && (modelTexturesId === "1" || modelTexturesId === "0")) showMessage("我还没有其他衣服呢！", 4000, 10);
                else loadModel(modelId, result.textures.id, "我的新衣服好看吗？");
            });
        }
    }

    async function loadOtherModel() {
        var modelId = localStorage.getItem("modelId");
        if (useCDN) {
            if (!modelList) await loadModelList();
            var index = ++modelId >= modelList.models.length ? 0 : modelId;
            loadModel(index, 0, modelList.messages[index]);
        } else {
            fetch(apiPath + "switch/?id=" + modelId).then(function (response) {
                return response.json();
            }).then(function (result) {
                loadModel(result.model.id, 0, result.model.message);
            });
        }
    }

    (function initModel() {
        var modelId = localStorage.getItem("modelId"),
            modelTexturesId = localStorage.getItem("modelTexturesId");
        if (modelId === null) {
            modelId = "1";
            modelTexturesId = "53";
        }
        var tipsPromise = fetch(waifuPath).then(function (response) {
            return response.json();
        });
        var listPromise = useCDN ? Promise.resolve(null) : fetch(apiPath + "model_list.json").then(function (r) {
            return r.json();
        }).catch(function () {
            return null;
        });
        Promise.all([tipsPromise, listPromise]).then(function (arr) {
            var result = arr[0],
                listJson = arr[1];
            modelSizes = result.model_sizes && typeof result.model_sizes === "object" ? result.model_sizes : {};
            if (listJson && listJson.models) apiModels = listJson.models;

            function bindSelectorMessages(entries, evtName) {
                if (!Array.isArray(entries)) return;
                window.addEventListener(evtName, function (event) {
                    for (var i = 0; i < entries.length; i++) {
                        var row = entries[i];
                        if (!event.target.matches(row.selector)) continue;
                        var msg = randomSelection(row.text).replace("{text}", event.target.innerText);
                        showMessage(msg, 4000, 8);
                        return;
                    }
                });
            }
            bindSelectorMessages(result.mouseover, "mouseover");
            bindSelectorMessages(result.click, "click");
            if (result.message && result.message.default) {
                var md = result.message.default;
                messageArray = (Array.isArray(md) ? md : [md]).concat(messageArray);
            }
            if (result.seasons) result.seasons.forEach(function (row) {
                var date = row.date,
                    text = row.text;
                var now = new Date(),
                    after = date.split("-")[0],
                    before = date.split("-")[1] || after;
                if ((after.split("/")[0] <= now.getMonth() + 1 && now.getMonth() + 1 <= before.split("/")[0]) && (after.split("/")[1] <= now.getDate() && now.getDate() <= before.split("/")[1])) {
                    text = randomSelection(text);
                    text = text.replace("{year}", now.getFullYear());
                    messageArray.push(text);
                }
            });
            var devtools = function () {};
            console.log("%c", devtools);
            if (result.message && result.message.console) {
                devtools.toString = function () {
                    showMessage(result.message.console, 6000, 9);
                };
            } else {
                devtools.toString = function () {
                    showMessage("哈哈，你打开了控制台，是想要看看我的小秘密吗？", 6000, 9);
                };
            }
            window.addEventListener("copy", function () {
                var m = result.message && result.message.copy ? result.message.copy : "你都复制了些什么呀，转载要记得加上出处哦！";
                showMessage(m, 6000, 9);
            });
            window.addEventListener("visibilitychange", function () {
                if (!document.hidden) {
                    var m = result.message && result.message.visibilitychange ? result.message.visibilitychange : "哇，你终于回来了～";
                    showMessage(m, 6000, 9);
                }
            });
            (function showWelcomeMessage(waifuJson) {
                var text;
                if (Array.isArray(waifuJson.time) && waifuJson.time.length && "/" === location.pathname) {
                    for (var i = 0; i < waifuJson.time.length; i++) {
                        var row = waifuJson.time[i];
                        var h = (new Date()).getHours();
                        var s = row.hour.split("-")[0];
                        var n = row.hour.split("-")[1] || s;
                        if (s <= h && h <= n) {
                            text = row.text;
                            break;
                        }
                    }
                }
                if (text == null) {
                    var t = "欢迎阅读<span>「" + document.title.split(" - ")[0] + "」</span>";
                    if (document.referrer !== "") {
                        var ref = new URL(document.referrer);
                        var sub = ref.hostname.split(".")[1];
                        var names = {
                            baidu: "百度",
                            so: "360搜索",
                            google: "谷歌搜索"
                        };
                        text = location.hostname === ref.hostname ? t : "Hello！来自 <span>" + (sub in names ? names[sub] : ref.hostname) + "</span> 的朋友<br>" + t;
                    } else {
                        text = t;
                    }
                }
                showMessage(text, 7000, 8);
            })(result);
            loadModel(modelId, modelTexturesId);
        });
    })();
}

function initWidget(config, apiPath) {
    if (typeof config === "string") {
        config = {
            waifuPath: config,
            apiPath: apiPath
        };
    }
    document.body.insertAdjacentHTML("beforeend", '<div id="waifu-toggle"><span>看板娘</span></div>');
    var toggle = document.getElementById("waifu-toggle");
    toggle.addEventListener("click", function () {
        toggle.classList.remove("waifu-toggle-active");
        if (toggle.getAttribute("first-time")) {
            loadWidget(config);
            toggle.removeAttribute("first-time");
        } else {
            localStorage.removeItem("waifu-display");
            document.getElementById("waifu").style.display = "";
            setTimeout(function () {
                document.getElementById("waifu").style.bottom = 0;
            }, 0);
        }
    });
    if (localStorage.getItem("waifu-display") && Date.now() - localStorage.getItem("waifu-display") <= 86400000) {
        toggle.setAttribute("first-time", true);
        setTimeout(function () {
            toggle.classList.add("waifu-toggle-active");
        }, 0);
    } else {
        loadWidget(config);
    }
}

window.initWidget = initWidget;
