import os
import shutil

def copy_static_files(config, **kwargs):
    site_dir = config['site_dir']
    copy_directory('dist', site_dir)
    copy_directory('plugins', site_dir)
    copy_directory('demos', site_dir)

def copy_directory(dir_path, site_dir):
    d = os.path.join(site_dir, dir_path)
    os.makedirs(d, exist_ok=True)
    copy_tree(dir_path, d)

def copy_tree(src, dst, symlinks=False, ignore=None):
    for item in os.listdir(src):
        s = os.path.join(src, item)
        d = os.path.join(dst, item)
        if os.path.isdir(s):
            shutil.copytree(s, d, symlinks, ignore)
        else:
            shutil.copy2(s, d)