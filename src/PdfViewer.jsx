import React from 'react';
import PropTypes from 'prop-types';
import PdfDocument from './PdfDocument.jsx'

export default class PdfViewer extends React.Component {
    static propTypes = {
      file: PropTypes.any, // Could be File object or URL string.
    };

    state = {};
    
    onDocumentComplete = (pages) => {
      this.setState({ page: 1, pages });
    }
  
    onPageComplete = (page) => {
      this.setState({ page });
    }
  
    handlePrevious = () => {
      this.setState({ page: this.state.page - 1 });
    }
  
    handleNext = () => {
      this.setState({ page: this.state.page + 1 });
    }
  
    renderPagination = (page, pages) => {
      let previousButton = <li className="previous" onClick={this.handlePrevious}><a href="#"><i className="fa fa-arrow-left"></i> Previous</a></li>;
      if (page === 1) {
        previousButton = <li className="previous disabled"><i className="fa fa-arrow-left"></i> Previous</li>;
      }
      let nextButton = <li className="next" onClick={this.handleNext}><a href="#">Next <i className="fa fa-arrow-right"></i></a></li>;
      if (page === pages) {
        nextButton = <li className="next disabled">Next <i className="fa fa-arrow-right"></i></li>;
      }
      return (
        <nav>
          <ul className="pager">
            {previousButton}
            {nextButton}
          </ul>
        </nav>
        );
    }
  
    render() {
      let pagination = null;
      if (this.state.pages) {
        pagination = this.renderPagination(this.state.page, this.state.pages);
      }
      return (
        <div>
          {pagination}
          <PdfDocument file={this.props.file} onDocumentComplete={this.onDocumentComplete} onPageComplete={this.onPageComplete} page={this.state.page} />
        </div>
      )
    }
}