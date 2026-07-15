


$(document).ready(function () {
    if (document.getElementById("ScrollSpeed").value === "0") {
        setTimeout(function () {     
                window.location.reload();
            },
            300 * 1000);
    }
    else {
        setTimeout(function() {
                setInterval(function() {
                    var height = $("#tbl-content").height();
                    var top = document.getElementById("tbl-content").scrollTop;
                    var scrollHeight = document.getElementById("tbl-content").scrollHeight;
                        if (height + top + 5 >= scrollHeight) {
                            setTimeout(function() {
                                    window.location.reload();
                                },
                                5000);
                        }
                    var currentTop = document.getElementById("tbl-content").scrollTop;
                    document.getElementById("tbl-content").scrollTop = currentTop + 2;
                    },
                    document.getElementById("ScrollSpeed").value * 75);
            },
            3000);
    }

});


$(document).ready(function() {
    $(window).on("load resize ", function () {
        var scrollWidth = $('.tbl-content').width() - $('.tbl-content table').width();
        $('.tbl-header').css({ 'padding-right': scrollWidth });
    }).resize();
});

let openVideoModal = function (e) {
    $.ajax({
        url: '/Ajax/GetVideoRoomForMeeting',
        data: { 'meetingNumber': e },
        dataType: "json",
        contentType: "application/json"
    }).done(function (response) {
        var parent = document.getElementById("video-room-select-div");
        parent.innerHTML = "";
        $.each(response.Item1, function (key, value) {
            console.log(key);
            let ul = document.createElement("ul");
            ul.className = "modal-room-cat";
            ul.innerHTML = key;
            $.each(value, function (i, roomName) {
                let div = document.createElement("div");
                let li = document.createElement("li");
                li.innerHTML = roomName;
                li.className = "modal-room-list";
                div.appendChild(li);
                ul.appendChild(div);

            });
            parent.appendChild(ul);
        });
        let ul = document.createElement("ul");
        ul.className = "modal-room-cat";
        ul.innerText = '行動會議室 '+response.Item2+ ' 人';
        parent.appendChild(ul);

        $("#videoRoomSelect").modal('show');

    });

    
};