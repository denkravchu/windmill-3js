const gulp = require('gulp');
const sass = require('gulp-sass'); // Компилятор scss
const autoprefixer = require('gulp-autoprefixer');
sass.compiler = require('node-sass'); // Устанавлиаем комплятор для scss node вместо dark
const sourcemaps = require('gulp-sourcemaps'); // Подгружает базовую версию кода
const gulpif = require('gulp-if'); // Тернарный оператор для .pipe
const del = require('del'); // Пакет удаления
const argv = require('yargs').argv; // Пакет для консольных переменных
const browserSync = require('browser-sync');
const gulpWatch = require('gulp-watch'); // Следит за изменениями в файлах
const image = require('gulp-image'); // Сжимает изображения
const htmlmin = require('gulp-htmlmin'); // Сжимает html
const cssnano = require('gulp-cssnano'); // Сжимает css
const shorthand = require('gulp-shorthand'); // Делает короткие записи стилей css
const uncss = require('gulp-uncss'); // Удаляет неиспользуемые стили css
const gcmq = require('gulp-group-css-media-queries'); // Собирает медиазапросы
const webpack = require('webpack-stream'); // Соединяет webpack с gulp




const paths = {  //Объект описывающий пути для функций

  root: './build', // Корень проекта

  html: { // Пути для html
    src:'./src/**/*.html',
    dest:'./build'
  },

  styles: { // Пути для стилей(scss)
    main: './src/scss/main.scss',
    dest: './build/css'
  },

  scripts: { // Пути для js
    main: './src/js/index.js',
    dest: './build/js'
  },

  scripts_libraries: {
    main: './src/js/libraries/*.js',
    dest: './build/js'
  },

  images: { // Пути для изображений
    src: './src/static/**',
    dest: './build/static'
  },

  fonts: {
    src: './src/fonts/**',
    dest: './build/fonts'
  },

  delete: { // Путь для зачистки содержимого корня
    dest: './build/*'
  }

}

let isDev = false; //Константа для девелоп режима
let lan = false; //Константа для тунеля
if (argv.dev) isDev = true; // if соединящий develop режим gulp с webpack/ argv - пакет gulp (при введение --dev запускает команды пренадлежащие develop режиму)
if (argv.lan) lan = true; // При введение --lan в консоль включает туннель

let webConfig = { /*КОНФИГ ВЕБПАКА*/
    output: {
      filename: 'all.js' // Имя конечного файла
    },
    module: {
      rules: [
          {
            test: /\.m?js$/,
            exclude: /(node_modules|bower_components)/, // Игнорирует содержимое
            use: {
              loader: 'babel-loader', // Использует babel
              options: {
                presets: ['@babel/preset-env'] // Степень сжатия (env - максимальная)
              }
            },
          }
        ]
    },
  // plugins: ['@babel/plugin-proposal-class-properties'],
  mode: isDev ? 'development' : 'production', // Настройка devel режима для webpacka
    // devtool: isDev ? 'eval-source-map' : 'none' // На devel режим запускает сурсмапу, на production ничего
};


function html() { /*ФУНКЦИЯ ПРЕБРАЗОВАНИЯ html*/
  return gulp.src(paths.html.src)
    .pipe(htmlmin({ // Минифицирует html
      collapseWhitespace: true, // Удаляет все переносы
      removeComments: true // Удаляет все комментарии
    }))
    .pipe(gulp.dest(paths.html.dest))
    .pipe(browserSync.stream());
}

function styles() {  /*ФУНКЦИЯ ПРЕБРАЗОВАНИЯ СТИЛЕЙ*/
  return gulp.src(paths.styles.main)
    .pipe(gulpif(argv.dev, sourcemaps.init())) // Инициализирует сурсмапу если в режима develop
    .pipe(sass({ // Компилит scss
       includePaths: require('node-normalize-scss').includePaths // Подклюяает сброс стилей
    }).on('error', sass.logError))
    .pipe(shorthand()) // Сокращает записи стилей
    .pipe(gcmq()) // Собирает медиазапросы
    .pipe(autoprefixer({ // Расставляет префиксы
          //  browsers: ['last 2 versions'], Теперь этот параметр прописан в package.json -> browserslist
            cascade: false
        }))
    // .pipe(gulpif(!argv.dev,cssnano())) // Минифицирует код в режиме production
    .pipe(gulpif(argv.dev,sourcemaps.write('.'))) // Показываем сурмапу если в режиме develop
    .pipe(gulp.dest(paths.styles.dest))
    .pipe(browserSync.stream()); // Браузерсинх
}

function scripts() { /*ФУНКЦИЯ ПРЕОБРАЗРОВАНИЯ JS*/
  return gulp.src(paths.scripts.main)
    .pipe(webpack(webConfig)) // Подключет webpack и выполняет то, что в конфиге "webConfig"
    .pipe(gulp.dest(paths.scripts.dest))
    .pipe(browserSync.stream());
}

function scripts_libraries() {
  return gulp.src(paths.scripts_libraries.main)
    .pipe(gulp.dest(paths.scripts_libraries.dest))
    .pipe(browserSync.stream());
}

function images() { /*ФУНКЦИЯ ПРЕОБРАЗОВАНИЯ ИЗОБРАЖЕНИЙ*/
  return gulp.src(paths.images.src)
    // .pipe(gulpif(!argv.dev,image({ // Минифицирует картинки (Можно использовать image-min для более точных настроек минификации)
    //   pngquant: true,
    //   optipng: false,
    //   zopflipng: true,
    //   jpegRecompress: false,
    //   mozjpeg: true,
    //   guetzli: false,
    //   gifsicle: true,
    //   svgo: false,
    //   concurrent: 10,
    //   quiet: true // defaults to false
    // })))
    .pipe(gulp.dest(paths.images.dest))
    .pipe(browserSync.stream());
}

function fonts() {
  return gulp.src(paths.fonts.src)
    .pipe(gulp.dest(paths.fonts.dest))
    .pipe(browserSync.stream());
}

function clean() { /*ФУНКЦИЯ ОЧИСТКИ ПАПКИ SRC*/
  return del([paths.delete.dest]);
}

function _watch() { /*ФУНКЦИЯ ЗАПУСКА СЛЕЖЕНИЯ ЗА ИЗМЕНЕНИЕМ ФАЙЛОВ*/
  browserSync.init({ // Инициализирует браузерсинх
    server: {
      baseDir: "./build" // Корневая папка проекта
    },
    tunnel: lan // Нужен для выдачи айпи на временном хостинге
  });

  gulp.watch('./src/**/*.html', html); // Запускает gulp watch для html
  gulp.watch('./src/js/**/*.js', scripts);
  gulp.watch('./src/js/libraries/**/*.js', scripts_libraries);
  gulp.watch('./src/scss/**/*.scss', styles);
  gulp.watch('./src/static/**', images);
  gulp.watch('./src/fonts/**', fonts);
  gulp.watch('./build/**/*.html', browserSync.reload); // При изменении html обновляет страничку

}

/*Инициализация тасков(команд) в отдельности*/
exports.styles = styles;
exports.scripts = scripts;
exports.scripts_libraries = scripts_libraries;
exports.html = html;
exports.fonts = fonts;
exports.images = images;
exports.clean = clean;
exports._watch = _watch;

gulp.task("build", gulp.series(clean, html, gulp.parallel(styles, scripts, images, fonts, scripts_libraries))); // Таск вызывающий последоваетльно мелкие таски, а затем параллельно
gulp.task("watch", gulp.series(clean, html, gulp.parallel(styles, scripts, images, fonts, scripts_libraries), _watch)); // Таск вызывающий последоваетльно мелкие таски, а затем параллельно + watch
