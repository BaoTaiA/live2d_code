<?php
/**
 * 返回模型分组列表，供演示页「文件夹 → 具体模型」下拉使用。
 * GET 无参，输出 JSON：groups[].folder、groups[].choices[]（modelId、textureId、label、path）
 */
require '../tools/modelList.php';
require '../tools/jsonCompatible.php';

$modelList = new modelList();
$jsonCompatible = new jsonCompatible();
$list = $modelList->get_list();
$models = isset($list['models']) && is_array($list['models']) ? $list['models'] : array();

$folderBuckets = array();

foreach ($models as $index => $entry) {
    $modelId = $index + 1;
    if (is_array($entry)) {
        $folder = null;
        $choicesInSlot = array();
        foreach ($entry as $j => $path) {
            if (!is_string($path)) {
                continue;
            }
            $parts = explode('/', $path, 2);
            $f = $parts[0];
            if ($folder === null) {
                $folder = $f;
            }
            $leaf = isset($parts[1]) ? $parts[1] : $path;
            $textureId = $j + 1;
            $choicesInSlot[] = array(
                'modelId' => $modelId,
                'textureId' => $textureId,
                'label' => $leaf,
                'path' => $path,
            );
        }
        if ($folder === null || !count($choicesInSlot)) {
            continue;
        }
        if (!isset($folderBuckets[$folder])) {
            $folderBuckets[$folder] = array();
        }
        foreach ($choicesInSlot as $row) {
            $folderBuckets[$folder][] = $row;
        }
    } elseif (is_string($entry)) {
        $parts = explode('/', $entry, 2);
        if (count($parts) >= 2) {
            $folder = $parts[0];
            $leaf = $parts[1];
        } else {
            $folder = '_root';
            $leaf = $entry;
        }
        if (!isset($folderBuckets[$folder])) {
            $folderBuckets[$folder] = array();
        }
        $folderBuckets[$folder][] = array(
            'modelId' => $modelId,
            'textureId' => 1,
            'label' => $leaf,
            'path' => $entry,
        );
    }
}

ksort($folderBuckets, SORT_NATURAL);
$groups = array();
foreach ($folderBuckets as $folder => $choices) {
    $groups[] = array(
        'folder' => $folder,
        'choices' => $choices,
    );
}

header('Content-Type: application/json; charset=utf-8');
echo $jsonCompatible->json_encode(array('groups' => $groups));
