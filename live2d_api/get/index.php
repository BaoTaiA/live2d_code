<?php
isset($_GET['id']) ? $id = $_GET['id'] : exit('error');

require '../tools/modelList.php';
require '../tools/modelTextures.php';
require '../tools/jsonCompatible.php';

$asset_cfg = require dirname(__DIR__) . '/asset_base.php';

$modelList = new modelList();
$modelTextures = new modelTextures();
$jsonCompatible = new jsonCompatible();

$id = explode('-', $id);
$modelId = (int)$id[0];
$modelTexturesId = isset($id[1]) ? (int)$id[1] : 0;

$entry = $modelList->id_to_name($modelId);
$modelNameIsArraySlot = is_array($entry);
if ($modelNameIsArraySlot) {
    $modelName = $modelTexturesId > 0 ? $entry[$modelTexturesId - 1] : $entry[0];
} else {
    $modelName = $entry;
}

$modelDir = '../model/' . $modelName;
$remote_base = '';
if (is_array($asset_cfg) && isset($asset_cfg['model_asset_base'])) {
    $remote_base = trim((string) $asset_cfg['model_asset_base']);
}
$basePrefix = ($remote_base === '')
    ? ('../model/' . $modelName . '/')
    : (rtrim($remote_base, '/') . '/' . $modelName . '/');

/* MOC3：Cubism model3.json，入口为 index3.json，路径写在 FileReferences 下 */
if (file_exists($modelDir . '/index3.json')) {
    $raw = file_get_contents($modelDir . '/index3.json');
    $json = json_decode($raw, true);
    if (!is_array($json) || !isset($json['FileReferences']) || !is_array($json['FileReferences'])) {
        header('Content-Type: application/json; charset=utf-8');
        echo $jsonCompatible->json_encode(array('error' => 'invalid index3.json'));
        exit;
    }
    $fr = &$json['FileReferences'];
    if (!empty($fr['Moc']) && is_string($fr['Moc'])) {
        $fr['Moc'] = $basePrefix . $fr['Moc'];
    }
    if (isset($fr['Textures']) && is_array($fr['Textures'])) {
        foreach ($fr['Textures'] as $k => $v) {
            if (is_string($v) && $v !== '') {
                $fr['Textures'][$k] = $basePrefix . $v;
            }
        }
    }
    if (!empty($fr['Physics']) && is_string($fr['Physics'])) {
        $fr['Physics'] = $basePrefix . $fr['Physics'];
    }
    if (!empty($fr['Pose']) && is_string($fr['Pose'])) {
        $fr['Pose'] = $basePrefix . $fr['Pose'];
    }
    if (!empty($fr['UserData']) && is_string($fr['UserData'])) {
        $fr['UserData'] = $basePrefix . $fr['UserData'];
    }
    if (isset($fr['Motions']) && is_array($fr['Motions'])) {
        foreach ($fr['Motions'] as $gk => $group) {
            if (!is_array($group)) {
                continue;
            }
            foreach ($group as $ki => $item) {
                if (is_array($item) && !empty($item['File']) && is_string($item['File'])) {
                    $fr['Motions'][$gk][$ki]['File'] = $basePrefix . $item['File'];
                }
            }
        }
    }
    if (isset($fr['Expressions']) && is_array($fr['Expressions'])) {
        foreach ($fr['Expressions'] as $ei => $ex) {
            if (is_array($ex) && !empty($ex['File']) && is_string($ex['File'])) {
                $fr['Expressions'][$ei]['File'] = $basePrefix . $ex['File'];
            }
        }
    }
    header('Content-Type: application/json; charset=utf-8');
    echo $jsonCompatible->json_encode($json);
    exit;
}

/* MOC2：index.json */
$indexPath = $modelDir . '/index.json';
if (!file_exists($indexPath)) {
    header('Content-Type: application/json; charset=utf-8');
    echo $jsonCompatible->json_encode(array('error' => 'model index not found'));
    exit;
}

$json = json_decode(file_get_contents($indexPath), true);
if (!is_array($json)) {
    header('Content-Type: application/json; charset=utf-8');
    echo $jsonCompatible->json_encode(array('error' => 'invalid index.json'));
    exit;
}

if (!$modelNameIsArraySlot && $modelTexturesId > 0) {
    $modelTexturesName = $modelTextures->get_name($modelName, $modelTexturesId);
    if (isset($modelTexturesName)) {
        $json['textures'] = is_array($modelTexturesName) ? $modelTexturesName : array($modelTexturesName);
    }
}

foreach ($json['textures'] as $k => $texture) {
    $json['textures'][$k] = $basePrefix . $texture;
}

$json['model'] = $basePrefix . $json['model'];
if (isset($json['pose'])) {
    $json['pose'] = $basePrefix . $json['pose'];
}
if (isset($json['physics'])) {
    $json['physics'] = $basePrefix . $json['physics'];
}

if (isset($json['motions'])) {
    foreach ($json['motions'] as $k => $v) {
        foreach ($v as $k2 => $v2) {
            foreach ($v2 as $k3 => $motion) {
                if ($k3 == 'file' || $k3 == 'sound') {
                    $json['motions'][$k][$k2][$k3] = $basePrefix . $motion;
                }
            }
        }
    }
}

if (isset($json['expressions'])) {
    foreach ($json['expressions'] as $k => $v) {
        foreach ($v as $k2 => $expression) {
            if ($k2 == 'file') {
                $json['expressions'][$k][$k2] = $basePrefix . $expression;
            }
        }
    }
}

header('Content-Type: application/json; charset=utf-8');
echo $jsonCompatible->json_encode($json);
