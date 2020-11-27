AstroAir客户端
=============
## 简介
- AstroAir是新一代的基于互联网的天文摄影终端，采用树莓派平台，具有良好的软件和设备兼容性，可以控制绝大多数的设备,进行预快便捷的天文摄影，我们目标就是让天文摄影变得简单。<br>
## 使用准备
- 树莓派，建议使用树莓派4b（4GB+），树莓派3b+性能较弱，运行时可能会出现较严重的卡顿；此外不建议使用树莓派400,体积过大，不方便安装在设备上。<br>
- Mirco-SD卡，建议使用三星32GB，其他品牌建议使用64GB以上的，否则可能会出现由于容量不足系统无法写入的问题。正在着手解决系统镜像过大的问题，计划压缩至原大小的四分之一[参考网站](https://shumeipai.nxez.com/2020/09/11/pishrink-make-raspberry-pi-images-smaller.html)。<br>
- 在使用前，建议先插好所有设备，否则可能会出现树莓派供电问题。<br>
## 安装客户端
- ### 安装依赖项
- ```sudo apt-get update&&sudo apt-get upgade     //系统更新```
- ```sudo apt-get install nginx php7.3-fpm php7.3-cgi php7.3-cli      //安装服务器```
- ```sudo apt-get install php7.3-xml    //如果要安装phpsysinfo```
- ```sudo apt-get install python3 python3-dev     //安装python编译环境，建议使用python3```
- ```sudo -H pip3 install indiweb     //安装INDI服务器```
- ```sudo apt install gpsd virtualgps     //安装GPS服务```
- ```sudo pip3 install gps3 gevent```
- ### 部署网页
- 将解压出来的文件放到/var/www文件夹<br>
- ### 自动启动
- 将所有的.service文件放到/etc/systemd/system,以virtualgps.service为例<br>
- ```sudo cp virtualgps.service /etc/systemd/system/```
- ```sudo chmod 644 /etc/systemd/system/virtualgps.service```
- ```sudo systemctl enable virtualgps.service```
- ### 重启后即可使用
## 问题报告
- 加入官方QQ群710622107，或直接在Github提交问题报告。
- 官方邮箱<astro_air@126.com>
