<?php
/**
 * 模型静态资源根（CDN / OSS）。
 * model_asset_base 留空：get 仍输出 ../model/...（与未配置时行为一致）。
 * 配置示例：https://i.tiax.cn/model
 * OSS 上目录需与本地 model/ 下一致：{根}/{modelName}/各文件（与 live2d_api/model/ 相对路径相同）。
 */
return array(
    'model_asset_base' => 'https://i.tiax.cn/model',
);
