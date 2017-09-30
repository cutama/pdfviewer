import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';

require('pdfjs-dist');
const pdfjsWorker = require('pdfjs-dist/build/pdf.worker.min');
const pdfjsWorkerBlob = new Blob([pdfjsWorker]);
const pdfjsWorkerBlobURL = URL.createObjectURL(pdfjsWorkerBlob);

PDFJS.workerSrc = pdfjsWorkerBlobURL;

//require('pdfjs-dist/build/pdf.combined');
//require('pdfjs-dist/web/compatibility');

export default class PdfDocument extends React.Component {
  static propTypes = {
    content: PropTypes.string,
    binaryContent: PropTypes.shape({
      data: PropTypes.any,
    }),
    file: PropTypes.any, // Could be File object or URL string.
    loading: PropTypes.any,
    page: PropTypes.number,
    scale: PropTypes.number,
    onDocumentComplete: PropTypes.func,
    onDocumentError: PropTypes.func,
    onPageComplete: PropTypes.func,
    className: PropTypes.string,
    style: PropTypes.object,
  };

  static defaultProps = {
    page: 1,
    scale: 0.0,
  };

  state = {};

  componentDidMount() {
    const parentNode = ReactDOM.findDOMNode(this).parentNode;
    this.setState({
      containerWidth: parentNode.offsetWidth,
      containerHeight: parentNode.offsetHeight
    });
    this.loadPDFDocument(this.props);
  }

  componentWillReceiveProps(newProps) {
    const { pdf } = this.state;

    // Only reload if the most significant source has changed!
    let newSource = newProps.file;
    let oldSource = newSource ? this.props.file : null;
    newSource = newSource || newProps.binaryContent;
    oldSource = newSource && !oldSource ? this.props.binaryContent : oldSource;
    newSource = newSource || newProps.content;
    oldSource = newSource && !oldSource ? this.props.content : oldSource;

    if (newSource && newSource !== oldSource &&
          ((newProps.file && newProps.file !== this.props.file) ||
          (newProps.content && newProps.content !== this.props.content))) {
      this.loadPDFDocument(newProps);
    }

    if (pdf && ((newProps.page && newProps.page !== this.props.page) ||
      (newProps.scale && newProps.scale !== this.props.scale))) {
      this.setState({ page: null });
      pdf.getPage(newProps.page).then(this.onPageComplete);
    }
  }

  componentWillUnmount() {
    const { pdf } = this.state;
    if (pdf) {
      pdf.destroy();
    }
    if (this.documentPromise) {
      this.documentPromise.cancel();
    }
  }

  onDocumentComplete = (pdf) => {
    this.setState({ pdf });
    const { onDocumentComplete } = this.props;
    if (typeof onDocumentComplete === 'function') {
      onDocumentComplete(pdf.numPages);
    }
    pdf.getPage(this.props.page).then(this.onPageComplete);
  }

  onDocumentError = (err) => {
    if (err.isCanceled && err.pdf) {
      err.pdf.destroy();
    }
    if (typeof this.props.onDocumentError === 'function') {
      this.props.onDocumentError(err);
    }
  }

  onPageComplete = (page) => {
    this.setState({ page });
    this.renderPdf();
    const { onPageComplete } = this.props;
    if (typeof onPageComplete === 'function') {
      onPageComplete(page.pageIndex + 1);
    }
  }

  getDocument = (val) => {
    if (this.documentPromise) {
      this.documentPromise.cancel();
    }
    this.documentPromise = makeCancelable(PDFJS.getDocument(val).promise);
    this.documentPromise
      .promise
      .then(this.onDocumentComplete)
      .catch(this.onDocumentError);
    return this.documentPromise;
  }

  loadPDFDocument = (props) => {
    if (props.file) {
      if (typeof props.file === 'string') {
        // Is a URL
        return this.getDocument(props.file);
      }
      // Is a File object
      const reader = new FileReader();
      reader.onloadend = () =>
        this.getDocument(new Uint8Array(reader.result));
      reader.readAsArrayBuffer(props.file);
    } else if (props.binaryContent) {
      this.getDocument(props.binaryContent);
    } else if (props.content) {
      const bytes = window.atob(props.content);
      const byteLength = bytes.length;
      const byteArray = new Uint8Array(new ArrayBuffer(byteLength));
      for (let index = 0; index < byteLength; index += 1) {
        byteArray[index] = bytes.charCodeAt(index);
      }
      this.getDocument(byteArray);
    } else {
      throw new Error('Needs a file(URL) or (base64)content. At least one needs to be provided!');
    }
  }

  renderPdf = () => {
    //console.log('containerWidth', this.state.containerWidth);
    //console.log('containerHeight', this.state.containerHeight);

    const { page, containerWidth, containerHeight } = this.state;
    if (page) {
      const { canvas } = this;
      const canvasContext = canvas.getContext('2d');
      const dpiScale = window.devicePixelRatio || 1;

      let { scale } = this.props;
      if (Math.abs(scale) < 1.0e-4) {
        const unscaledViewport = page.getViewport(1.0);
        const ratioViewport = unscaledViewport.width / unscaledViewport.height;
        const ratioContainer = this.state.containerWidth / this.state.containerHeight;
        scale = ratioContainer >= ratioViewport ? this.state.containerHeight / unscaledViewport.height :
          this.state.containerWidth / unscaledViewport.width;
      }

      const adjustedScale = scale * dpiScale;
      const viewport = page.getViewport(adjustedScale);

      canvas.style.width = `${viewport.width / dpiScale}px`;
      canvas.style.height = `${viewport.height / dpiScale}px`;
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      page.render({ canvasContext, viewport });
    }
  }

  render() {
    const { loading } = this.props;
    const { page } = this.state;
    return page ?
      <canvas
        ref={(c) => { this.canvas = c; }}
        className='ba-pdf-viewer-canvas'
      /> :
      loading || <div>Loading PDF...</div>;
  }
}

const makeCancelable = (promise) => {
  let hasCanceled = false;

  const wrappedPromise = new Promise((resolve, reject) => {
    promise.then(val => (
      hasCanceled ? reject({ pdf: val, isCanceled: true }) : resolve(val)
    ));
    promise.catch(error => (
      hasCanceled ? reject({ isCanceled: true }) : reject(error)
    ));
  });

  return {
    promise: wrappedPromise,
    cancel() {
      hasCanceled = true;
    },
  };
};
